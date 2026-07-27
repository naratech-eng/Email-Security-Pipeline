import { ShieldAlert } from 'lucide-react';

/** Shown when the Cognito env vars aren't configured (dev without .env.local). */
export default function MissingEnv() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <ShieldAlert className="size-10 text-verdict-flag" aria-hidden />
      <h1 className="text-xl font-semibold text-foreground">Configuration needed</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Cognito environment variables aren&rsquo;t set. Copy{' '}
        <code className="font-mono text-primary">.env.example</code> to{' '}
        <code className="font-mono text-primary">.env.local</code> and fill in
        the pool id, client id, and region, then restart the dev server.
      </p>
    </div>
  );
}
