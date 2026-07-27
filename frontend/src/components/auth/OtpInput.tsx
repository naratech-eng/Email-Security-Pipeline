import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Segmented one-time-code entry with auto-advance + paste support. */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  'aria-label': ariaLabel = 'One-time code',
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');

  function setChar(i: number, c: string) {
    const digit = c.replace(/\D/g, '').slice(-1);
    const next = chars.slice();
    next[i] = digit;
    onChange(next.join('').slice(0, length));
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      onChange(pasted);
      refs.current[Math.min(pasted.length, length - 1)]?.focus();
    }
  }

  return (
    <div className="flex gap-2" role="group" aria-label={ariaLabel}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={c}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => setChar(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          className={cn(
            'h-12 w-11 rounded-md border border-input bg-surface text-center font-mono text-lg text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:opacity-50',
          )}
        />
      ))}
    </div>
  );
}
