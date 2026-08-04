import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ClipboardPaste, FileUp, Info, ScanSearch, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ACCEPTED_EMAIL_EXTENSIONS, MAX_EMAIL_BYTES } from '@/lib/api';
import {
  inputSize,
  validateEmailInput,
  type EmailInput,
  type ValidationIssue,
} from '@/lib/emailInput';
import { fadeInUp } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface EmailComposerProps {
  onSubmit: (input: EmailInput) => void;
  /** True while a scan is in flight — the composer locks rather than queueing. */
  busy: boolean;
  /**
   * Seeds the composer after a failed or timed-out run, so the analyst edits
   * and resubmits their draft instead of retyping a long paste.
   */
  initialInput?: EmailInput | null;
}

type Mode = 'paste' | 'file';

/** The one input the API accepts, assembled from whichever mode is active. */
function buildInput(mode: Mode, text: string, file: File | null): EmailInput | null {
  if (mode === 'paste') return text.trim() ? { mode: 'paste', text } : null;
  return file ? { mode: 'file', file } : null;
}

/**
 * The intake surface: paste a raw email or drop an .eml.
 *
 * The two modes share ONE input value rather than two independent fields, so
 * the "exactly one input" rule the API enforces can't be violated by the UI
 * holding both. Switching modes replaces the input; it never merges them.
 */
export function EmailComposer({ onSubmit, busy, initialInput }: EmailComposerProps) {
  const [mode, setMode] = useState<Mode>(initialInput?.mode ?? 'paste');
  const [text, setText] = useState(
    initialInput?.mode === 'paste' ? initialInput.text : '',
  );
  const [file, setFile] = useState<File | null>(
    initialInput?.mode === 'file' ? initialInput.file : null,
  );
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const input = buildInput(mode, text, file);

  // Identity of what we're validating. `input` is rebuilt every render, so it
  // can't be compared by reference; a file is identified by the fields that
  // change when the analyst picks a different one.
  const inputKey =
    mode === 'paste'
      ? `paste:${text}`
      : `file:${file?.name ?? ''}:${file?.size ?? ''}:${file?.lastModified ?? ''}`;

  // Validate as the input changes, not only on submit, so the disabled submit
  // button is itself the feedback and nothing is discovered after a 40s wait.
  //
  // Only the settled answer is stored, tagged with the input it describes.
  // "Currently checking" is then derived — it's exactly "the stored answer is
  // for a different input than the one on screen" — rather than being a second
  // state field flipped on from inside the effect. That also removes a stale
  // read the old split allowed: `issue` kept describing the *previous* input
  // for one render after a keystroke, so a blocking issue could briefly be
  // reported against text the analyst had already replaced.
  const [checked, setChecked] = useState<{
    key: string;
    issue: ValidationIssue | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Rebuilt from the primitives rather than closing over the render-scoped
    // `input`, which is a fresh object every render and would re-run this on
    // every one.
    void validateEmailInput(buildInput(mode, text, file)).then((result) => {
      if (!cancelled) setChecked({ key: inputKey, issue: result });
    });
    return () => {
      cancelled = true;
    };
  }, [mode, text, file, inputKey]);

  const settled = checked?.key === inputKey ? checked : null;
  const checking = settled === null;
  const issue = settled?.issue ?? null;

  const blocked = !input || issue?.level === 'blocking' || checking;
  const bytes = input ? inputSize(input) : 0;
  const nearLimit = bytes > MAX_EMAIL_BYTES * 0.8;

  function chooseFile(next: File | null) {
    setFile(next);
    if (next) setMode('file');
  }

  function switchTo(next: Mode) {
    if (busy || next === mode) return;
    setMode(next);
  }

  return (
    <motion.section
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      className="rounded-xl border border-border bg-surface p-5"
      aria-label="Submit an email for analysis"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Input mode"
          className="inline-flex rounded-lg border border-border p-0.5"
        >
          <ModeTab
            active={mode === 'paste'}
            disabled={busy}
            icon={ClipboardPaste}
            label="Paste email"
            onClick={() => switchTo('paste')}
          />
          <ModeTab
            active={mode === 'file'}
            disabled={busy}
            icon={FileUp}
            label="Upload .eml"
            onClick={() => switchTo('file')}
          />
        </div>

        {bytes > 0 && (
          <span
            className={cn(
              'text-xs tabular-nums',
              nearLimit ? 'text-[var(--verdict-flag)]' : 'text-muted-foreground',
            )}
          >
            {formatBytes(bytes)} / {formatBytes(MAX_EMAIL_BYTES)}
          </span>
        )}
      </div>

      {mode === 'paste' ? (
        <label className="block">
          <span className="sr-only">Raw email source</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={12}
            spellCheck={false}
            aria-invalid={issue?.level === 'blocking' || undefined}
            aria-describedby={issue?.message ? 'composer-issue' : undefined}
            placeholder={'From: sender@example.com\nSubject: Your account needs verification\n\nPaste the full raw source, headers included.'}
            className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
        </label>
      ) : (
        <DropZone
          file={file}
          dragging={dragging}
          disabled={busy}
          invalid={issue?.level === 'blocking'}
          onDraggingChange={setDragging}
          onFile={chooseFile}
          onBrowse={() => fileInputRef.current?.click()}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EMAIL_EXTENSIONS.join(',')}
        className="hidden"
        onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
      />

      {/* Inline and attached to the input, never a toast: a validation problem
          is about the thing on screen, not the outcome of a finished action. */}
      <div className="mt-3 min-h-[1.25rem]" aria-live="polite">
        {issue?.message ? (
          <p
            id="composer-issue"
            className={cn(
              'flex items-start gap-2 text-xs',
              issue.level === 'blocking'
                ? 'text-[var(--verdict-quarantine)]'
                : 'text-[var(--verdict-flag)]',
            )}
          >
            {issue.level === 'blocking' ? (
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
            ) : (
              <Info className="mt-px size-3.5 shrink-0" />
            )}
            {issue.message}
          </p>
        ) : (
          !input && (
            <p className="text-xs text-muted-foreground">
              Paste a raw email or drop an {ACCEPTED_EMAIL_EXTENSIONS.join(' / ')} file to analyse.
            </p>
          )
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => input && onSubmit(input)} disabled={blocked || busy}>
          <ScanSearch className="size-4" />
          Analyse email
        </Button>
        {issue?.level === 'warning' && (
          <span className="text-xs text-muted-foreground">Submitting is still allowed.</span>
        )}
      </div>
    </motion.section>
  );
}

function ModeTab({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: typeof ClipboardPaste;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function DropZone({
  file,
  dragging,
  disabled,
  invalid,
  onDraggingChange,
  onFile,
  onBrowse,
}: {
  file: File | null;
  dragging: boolean;
  disabled: boolean;
  invalid: boolean;
  onDraggingChange: (v: boolean) => void;
  onFile: (f: File | null) => void;
  onBrowse: () => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) onDraggingChange(true);
      }}
      onDragLeave={() => onDraggingChange(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDraggingChange(false);
        if (!disabled) onFile(e.dataTransfer.files?.[0] ?? null);
      }}
      className={cn(
        'flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors',
        dragging && 'border-primary bg-primary/5',
        invalid && 'border-[var(--verdict-quarantine)]',
        !dragging && !invalid && 'border-border',
        disabled && 'opacity-60',
      )}
    >
      {file ? (
        <>
          <Badge className="max-w-full truncate font-mono text-xs">{file.name}</Badge>
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onFile(null)}>
            <X className="size-4" />
            Remove
          </Button>
        </>
      ) : (
        <>
          <FileUp className="size-7 text-muted-foreground" />
          <p className="text-sm text-foreground">Drop an email file here</p>
          <p className="text-xs text-muted-foreground">
            {ACCEPTED_EMAIL_EXTENSIONS.join(' or ')}, up to {formatBytes(MAX_EMAIL_BYTES)}
          </p>
          <Button variant="outline" size="sm" disabled={disabled} onClick={onBrowse}>
            Choose a file
          </Button>
        </>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
