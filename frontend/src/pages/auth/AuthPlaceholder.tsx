import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Bare (shell-less) placeholder for the auth surfaces. The real themed
 * login / register / verify / email-OTP MFA / forgot-password tree lands in
 * slice 2; this keeps the route resolvable meanwhile.
 */
export default function AuthPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-7 text-primary" aria-hidden />
        <span className="font-mono text-lg font-semibold">
          ESP<span className="text-primary"> / SOC</span>
        </span>
      </div>
      <div className="w-full max-w-sm space-y-2 rounded-xl border border-border bg-surface px-8 py-10">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="font-mono text-xs uppercase tracking-wider text-primary">
          Slice 2 — Authentication
        </p>
        <p className="pt-2 text-sm text-muted-foreground">
          Custom themed Cognito auth (sign-up, email verification, email-OTP MFA,
          forgot-password) is built in the next slice.
        </p>
      </div>
      <Button asChild variant="ghost">
        <Link to="/">Continue to the console preview</Link>
      </Button>
    </div>
  );
}
