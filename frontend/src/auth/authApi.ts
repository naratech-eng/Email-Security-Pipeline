import { fetchAuthSession } from 'aws-amplify/auth';
import { apiBaseUrl } from '@/lib/env';

/** Access token for the current session, or null if unauthenticated. */
export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
    return null;
  }
}

/** Authenticated fetch: injects the Cognito access token as a Bearer header. */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers });
}

export type ClaimRoleResult = 'claimed' | 'not_available' | 'error';

/**
 * Ask the backend to assign the caller's Cognito group from their verified
 * custom:role. Backend endpoint is being built in parallel — degrade on 404.
 */
export async function claimRole(): Promise<ClaimRoleResult> {
  try {
    const res = await apiFetch('/users/claim-role', { method: 'POST' });
    if (res.ok) return 'claimed';
    if (res.status === 404) return 'not_available';
    return 'error';
  } catch {
    return 'error';
  }
}
