import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { Loader2, MailCheck, RefreshCw } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthProvider';
import { claimRole } from '@/auth/authApi';

const ROLE_LABELS: Record<string, string> = {
  'soc-analyst': 'SOC Analyst',
  'security-operator': 'Security Operator',
  'security-analyst': 'Security Analyst',
};

export default function Pending() {
  const { status, user, isPending, refresh, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const claimed = useRef(false);

  async function attemptClaim() {
    setBusy(true);
    setNote(null);
    const result = await claimRole();
    if (result === 'not_available') {
      setNote(
        'Role assignment isn’t available yet. An admin will enable your access shortly — check back soon.',
      );
    } else if (result === 'error') {
      setNote('Couldn’t reach the server. Try again in a moment.');
    }
    await refresh({ force: true });
    setBusy(false);
  }

  // Attempt the claim once per mount (not on every render).
  useEffect(() => {
    if (claimed.current || status !== 'authenticated' || !isPending) return;
    claimed.current = true;
    void attemptClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isPending]);

  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (status === 'authenticated' && !isPending) return <Navigate to="/" replace />;

  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : null;

  return (
    <AuthLayout
      title="Your account is being set up"
      subtitle="You’re signed in — we’re provisioning your role."
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-4">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="text-foreground">
              {roleLabel
                ? `You registered as ${roleLabel}. Access unlocks once that role is assigned.`
                : 'Your role is pending assignment.'}
            </p>
            {note && <p className="text-muted-foreground">{note}</p>}
          </div>
        </div>

        <Button onClick={attemptClaim} className="w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check status
        </Button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </AuthLayout>
  );
}
