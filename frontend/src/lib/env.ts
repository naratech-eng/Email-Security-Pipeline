/**
 * Typed accessor over import.meta.env. Nothing is hardcoded — every value comes
 * from a VITE_* variable.
 *
 * Validation is LAZY on purpose: the shell (slice 1) only needs the env label,
 * so reading a missing Cognito/API var throws at the point of USE (fail-fast
 * where it matters) rather than crashing the whole app at import time before
 * auth even exists.
 */

type AppEnvLabel = 'DEV' | 'PROD';

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/** Base URL of the FastAPI inference service. Throws if unset. */
export function apiBaseUrl(): string {
  return required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL);
}

export interface CognitoConfig {
  userPoolId: string;
  userPoolClientId: string;
  region: string;
}

/** Cognito user-pool config for Amplify. Throws if any value is unset. */
export function cognitoConfig(): CognitoConfig {
  return {
    userPoolId: required(
      'VITE_COGNITO_USER_POOL_ID',
      import.meta.env.VITE_COGNITO_USER_POOL_ID,
    ),
    userPoolClientId: required(
      'VITE_COGNITO_CLIENT_ID',
      import.meta.env.VITE_COGNITO_CLIENT_ID,
    ),
    region: required('VITE_COGNITO_REGION', import.meta.env.VITE_COGNITO_REGION),
  };
}

/** Deployment label for the top-bar badge. Safe default: DEV. */
export function envLabel(): AppEnvLabel {
  return import.meta.env.VITE_APP_ENV === 'PROD' ? 'PROD' : 'DEV';
}
