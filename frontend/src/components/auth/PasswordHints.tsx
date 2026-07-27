import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Cognito password policy (matches infra/modules/cognito password_policy). */
export const PASSWORD_RULES = [
  { label: 'At least 12 characters', test: (p: string) => p.length >= 12 },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'A number', test: (p: string) => /\d/.test(p) },
  {
    label: 'A symbol',
    test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p),
  },
] as const;

export function passwordValid(password: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(password));
}

export function PasswordHints({ password }: { password: string }) {
  return (
    <ul className="mt-2 grid gap-1" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn(
              'flex items-center gap-2 text-xs',
              ok ? 'text-verdict-clean' : 'text-muted-foreground',
            )}
          >
            {ok ? (
              <Check className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <X className="size-3.5 shrink-0" aria-hidden />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
