import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import { usePermissions, type Permissions } from './usePermissions';

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <ShieldCheck className="size-8 animate-pulse text-primary" aria-hidden />
      <p className="font-mono text-sm">{label}</p>
    </div>
  );
}

/**
 * Gate the protected app. Unauthenticated → /login (intended path preserved);
 * authenticated-but-no-group → /pending; otherwise render the shell.
 */
export function RequireAuth() {
  const { status, isPending } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullScreenLoader label="Verifying session…" />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (isPending) return <Navigate to="/pending" replace />;
  return <Outlet />;
}

/**
 * Control-level gate for capability-restricted routes (analyze, users).
 * Unauthorized → redirect to Overview with a toast, before the page mounts.
 */
export function RequireCapability({
  cap,
  children,
}: {
  cap: keyof Permissions;
  children: ReactNode;
}) {
  const perms = usePermissions();
  const allowed = Boolean(perms[cap]);

  useEffect(() => {
    if (!allowed) toast.error("You don't have access to that page.");
  }, [allowed]);

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
