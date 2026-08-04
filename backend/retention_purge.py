"""
M9-T7 — scheduled detection-record retention purge.

Deletes `detections` rows older than RETENTION_DAYS (default 180, see
docs/data-retention-privacy.md for the policy this implements). Runs as a
one-off ECS task on an EventBridge Scheduler cron (infra/modules/ecs_service),
reusing the API's own container image with the entrypoint overridden to this
script instead of uvicorn -- no separate image/build pipeline needed.

Unlike backend/db.py's fail-open persistence (a live request is waiting on
that one), this fails loudly: nobody is blocked on a scheduled maintenance
job, and a silent failure here would just mean retention quietly stops
happening. Exits non-zero on any DB error so the ECS task shows FAILED and
CloudWatch Logs carries the reason.
"""
import os
import sys

import psycopg

from db import _resolve_db_url  # noqa: E402 -- reuses the same connection-string logic

DEFAULT_RETENTION_DAYS = 180


def main() -> int:
    url = _resolve_db_url()
    if not url:
        sys.stderr.write("retention_purge: DB_CREDENTIALS_JSON not set, cannot run\n")
        return 1

    try:
        retention_days = int(os.environ.get('RETENTION_DAYS', DEFAULT_RETENTION_DAYS))
    except ValueError:
        sys.stderr.write(f"retention_purge: invalid RETENTION_DAYS={os.environ.get('RETENTION_DAYS')!r}\n")
        return 1

    try:
        with psycopg.connect(url, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM detections WHERE created_at < now() - make_interval(days => %(days)s)",
                    {'days': retention_days},
                )
                deleted = cur.rowcount
            conn.commit()
    except Exception as e:
        sys.stderr.write(f"retention_purge: failed: {e}\n")
        return 1

    print(f"retention_purge: deleted {deleted} detection row(s) older than {retention_days} days")
    return 0


if __name__ == '__main__':
    sys.exit(main())
