"""
M7-T14: Cognito access-token verification (JWKS).

Verifies dashboard user tokens against the pool's public keys. Kept separate
from the static-key path in main.py (require_auth), which the mail content
filter still uses for internal server->API calls.
"""
import functools
import os
from typing import Optional

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError


def get_config() -> tuple[Optional[str], str, Optional[str]]:
    """(user_pool_id, region, app_client_id) from env."""
    pool = os.environ.get('COGNITO_USER_POOL_ID')
    region = (
        os.environ.get('COGNITO_REGION')
        or os.environ.get('AWS_REGION')
        or 'us-east-1'
    )
    client_id = os.environ.get('COGNITO_APP_CLIENT_ID')
    return pool, region, client_id


def cognito_configured() -> bool:
    pool, _, _ = get_config()
    return bool(pool)


def _issuer(pool: str, region: str) -> str:
    return f'https://cognito-idp.{region}.amazonaws.com/{pool}'


# How long to wait for the JWKS fetch. PyJWT defaults to no timeout, which turns
# an unreachable Cognito endpoint (no NAT, missing VPC endpoint, transient DNS)
# into an indefinitely hanging request instead of an error — every authenticated
# call blocks and the worker pool fills up. Bounded so the failure is loud.
JWKS_TIMEOUT_SECONDS = 5


# PyJWKClient caches the fetched keys internally; one client per issuer.
@functools.lru_cache(maxsize=4)
def _jwks_client(issuer: str) -> PyJWKClient:
    return PyJWKClient(
        f'{issuer}/.well-known/jwks.json',
        timeout=JWKS_TIMEOUT_SECONDS,
    )


class TokenError(Exception):
    """Raised when a Cognito token fails verification (client's fault → 401)."""


class TokenBackendError(Exception):
    """
    Raised when verification could not be COMPLETED — the JWKS endpoint was
    unreachable or timed out. Distinct from TokenError because the caller's
    token may be perfectly valid: answering 401 here would tell a signed-in
    analyst to re-authenticate over and over against a service problem.
    """


def verify_access_token(token: str) -> dict:
    """
    Validate a Cognito **access** token: signature (RS256 via JWKS), issuer,
    expiry, token_use, and — when configured — the app client id. Returns the
    decoded claims (sub, username, cognito:groups, …) or raises TokenError.
    """
    pool, region, client_id = get_config()
    if not pool:
        raise TokenError('Cognito is not configured on this service.')

    issuer = _issuer(pool, region)
    try:
        signing_key = _jwks_client(issuer).get_signing_key_from_jwt(token)
    except PyJWKClientConnectionError as e:
        # Could not reach the JWKS endpoint — a service problem, not a bad token.
        raise TokenBackendError(f'Could not reach the Cognito JWKS endpoint: {e}') from e

    try:
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=['RS256'],
            issuer=issuer,
            # Access tokens carry `client_id`, not `aud`; check it manually below.
            options={'verify_aud': False},
        )
    except Exception as e:  # noqa: BLE001 — normalize any jwt error to 401 upstream
        raise TokenError(f'Invalid token: {e}') from e

    if claims.get('token_use') != 'access':
        raise TokenError('Expected an access token.')
    if client_id and claims.get('client_id') != client_id:
        raise TokenError('Token was issued for a different client.')
    return claims
