import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchAuthSession, fetchUserAttributes, signOut } from 'aws-amplify/auth';

export interface AuthUser {
  sub: string;
  email: string;
  groups: string[];
  role?: string;
  gender?: string;
  avatarUrl?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Authenticated but not yet in any Cognito group (role not provisioned). */
  isPending: boolean;
  /** Re-read the session + attributes (call after claim-role or profile edits). */
  refresh: (opts?: { force?: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

/**
 * Read the session and profile attributes. Deliberately writes no state:
 * keeping "who is signed in?" separate from "commit that to React" is what
 * lets the mount path discard a result that lands after unmount, and keeps the
 * mount effect from driving state updates out of its own body.
 *
 * Returns null for every unauthenticated outcome — no tokens, or a failed
 * session read — since the provider treats them identically.
 */
async function loadAuthUser(opts?: { force?: boolean }): Promise<AuthUser | null> {
  const session = await fetchAuthSession(opts?.force ? { forceRefresh: true } : undefined);
  const idPayload = session.tokens?.idToken?.payload;
  if (!idPayload) return null;

  let attrs: Record<string, string | undefined> = {};
  try {
    attrs = await fetchUserAttributes();
  } catch {
    // Attributes are best-effort; the token already carries identity.
  }

  return {
    sub: String(idPayload.sub ?? ''),
    email: String(idPayload.email ?? attrs.email ?? ''),
    groups: asStringArray(idPayload['cognito:groups']),
    role: attrs['custom:role'],
    gender: attrs['custom:gender'],
    avatarUrl: attrs['custom:avatar_url'],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    const next = await loadAuthUser(opts).catch(() => null);
    setUser(next);
    setStatus(next ? 'authenticated' : 'unauthenticated');
  }, []);

  // The initial read, on mount. This does not call `refresh()`: the session
  // lookup is a subscription to an external system, so the state writes belong
  // in the async callback rather than the effect body, and unlike a
  // user-triggered refresh this one can still be in flight when the provider
  // unmounts (a sign-out redirect during a cold start) — `cancelled` keeps that
  // late answer from resurrecting a user on a torn-down tree.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await loadAuthUser().catch(() => null);
      if (cancelled) return;
      setUser(next);
      setStatus(next ? 'authenticated' : 'unauthenticated');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const doSignOut = useCallback(async () => {
    await signOut();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isPending: status === 'authenticated' && (user?.groups.length ?? 0) === 0,
      refresh,
      signOut: doSignOut,
    }),
    [status, user, refresh, doSignOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
