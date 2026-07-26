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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    try {
      const session = await fetchAuthSession(
        opts?.force ? { forceRefresh: true } : undefined,
      );
      const idPayload = session.tokens?.idToken?.payload;
      if (!idPayload) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }

      let attrs: Record<string, string | undefined> = {};
      try {
        attrs = await fetchUserAttributes();
      } catch {
        // Attributes are best-effort; the token already carries identity.
      }

      setUser({
        sub: String(idPayload.sub ?? ''),
        email: String(idPayload.email ?? attrs.email ?? ''),
        groups: asStringArray(idPayload['cognito:groups']),
        role: attrs['custom:role'],
        gender: attrs['custom:gender'],
        avatarUrl: attrs['custom:avatar_url'],
      });
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
