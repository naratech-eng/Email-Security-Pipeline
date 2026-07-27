import { ACCEPTED_EMAIL_EXTENSIONS, MAX_EMAIL_BYTES } from '@/lib/api';

/**
 * Pre-submit checks for the Analyze composer.
 *
 * These are a courtesy to the analyst, NOT a security control: the same limits
 * hold server-side, and anything hostile bypasses the browser entirely. The
 * point is that nobody should spend a ~40s cold start to learn something the
 * browser knew instantly.
 */

/** The one input, as a single value — never two independent fields. */
export type EmailInput =
  | { mode: 'paste'; text: string }
  | { mode: 'file'; file: File };

export type ValidationLevel = 'blocking' | 'warning';

export interface ValidationIssue {
  level: ValidationLevel;
  /** Stable discriminator so the UI can key off the kind, not the wording. */
  kind: 'empty' | 'unsupported-type' | 'oversize' | 'binary' | 'not-email-like';
  message: string;
}

/** Bytes in a string as UTF-8 — the same measure the backend applies. */
export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Byte size of either input mode, for the live counter and the size check. */
export function inputSize(input: EmailInput): number {
  return input.mode === 'file' ? input.file.size : utf8Bytes(input.text);
}

export function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EMAIL_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Any RFC 5322 header at line-start. Order isn't guaranteed, so this asks "does
 * a known header appear near the top", not "does it start with From:".
 */
const HEADER_RE =
  /^(From|To|Subject|Date|Received|Message-ID|Return-Path|MIME-Version|Delivered-To|Reply-To):/im;

/** How much of the file to sniff. Enough for a header block, instant to read. */
const SNIFF_BYTES = 2048;

interface Sniffed {
  binary: boolean;
  emailLike: boolean;
}

/**
 * Read the first 2 KB and judge the content, because neither the filename nor
 * `File.type` carries real information: extensions are trivially renamed, and
 * browsers report `.eml` inconsistently (`message/rfc822`, `application/octet-stream`,
 * or empty, depending on the OS).
 */
export async function sniffFile(file: File): Promise<Sniffed> {
  const head = await file.slice(0, SNIFF_BYTES).text();
  return {
    // NUL bytes mean it isn't text under any encoding — a PDF or ZIP renamed
    // to .eml lands here, and submitting it wastes a cold start for certain.
    binary: head.includes('\u0000'),
    emailLike: HEADER_RE.test(head),
  };
}

/**
 * The full check. Returns the single most blocking issue, or null when the
 * input is submittable — one message at a time reads as guidance; a list of
 * three simultaneous complaints reads as a failure wall.
 *
 * A `warning` is submittable on purpose: the server's parser is more tolerant
 * than any browser heuristic, and blocking a valid-but-unusual message is worse
 * than letting an odd one through.
 */
export async function validateEmailInput(
  input: EmailInput | null,
): Promise<ValidationIssue | null> {
  if (!input) return { level: 'blocking', kind: 'empty', message: '' };

  if (input.mode === 'paste') {
    if (!input.text.trim()) {
      return { level: 'blocking', kind: 'empty', message: '' };
    }
    if (utf8Bytes(input.text) > MAX_EMAIL_BYTES) {
      return oversize(utf8Bytes(input.text));
    }
    // Pasted text that doesn't look like a raw message is worth flagging (an
    // analyst may have pasted a rendered body), but never worth blocking.
    if (!HEADER_RE.test(input.text.slice(0, SNIFF_BYTES))) {
      return {
        level: 'warning',
        kind: 'not-email-like',
        message:
          "No email headers found — this looks like a message body rather than a raw email. Analysis still works, but header signals will be missing.",
      };
    }
    return null;
  }

  const { file } = input;

  if (!hasAcceptedExtension(file.name)) {
    return {
      level: 'blocking',
      kind: 'unsupported-type',
      message: `${file.name} isn't an email file. Drop a ${ACCEPTED_EMAIL_EXTENSIONS.join(' or ')} export.`,
    };
  }
  if (file.size > MAX_EMAIL_BYTES) return oversize(file.size);

  const { binary, emailLike } = await sniffFile(file);
  if (binary) {
    return {
      level: 'blocking',
      kind: 'binary',
      message: `${file.name} contains binary data, so it isn't a raw email. Export the message as .eml and try again.`,
    };
  }
  if (!emailLike) {
    return {
      level: 'warning',
      kind: 'not-email-like',
      message: `No email headers found in ${file.name}. Analyse anyway?`,
    };
  }
  return null;
}

function oversize(bytes: number): ValidationIssue {
  const mb = (bytes / 1024 / 1024).toFixed(1);
  const limitMb = MAX_EMAIL_BYTES / 1024 / 1024;
  return {
    level: 'blocking',
    kind: 'oversize',
    message: `That email is ${mb} MB — the limit is ${limitMb} MB. Trim it and try again.`,
  };
}
