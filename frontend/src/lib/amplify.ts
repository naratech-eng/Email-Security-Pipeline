import { Amplify } from 'aws-amplify';
import { avatarStorageConfig } from '@/lib/env';

/**
 * Configure Amplify v6 (Auth + optional Storage) from env. Best-effort: returns
 * false when the required Cognito vars are missing so the app can render a
 * "configure your env" notice instead of crashing to a blank screen.
 */
export function configureAmplify(): boolean {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  if (!userPoolId || !userPoolClientId) return false;

  const storage = avatarStorageConfig();

  // Two concrete shapes: the identity pool + Storage only exist when configured
  // (that's what enables the authenticated S3 avatar upload path).
  if (storage) {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
          identityPoolId: storage.identityPoolId,
          loginWith: { email: true },
        },
      },
      Storage: {
        S3: { bucket: storage.bucket, region: storage.region },
      },
    });
  } else {
    Amplify.configure({
      Auth: {
        Cognito: { userPoolId, userPoolClientId, loginWith: { email: true } },
      },
    });
  }

  return true;
}

/** True when avatar uploads to S3 are available (identity pool + bucket set). */
export function avatarUploadEnabled(): boolean {
  return avatarStorageConfig() !== null;
}
