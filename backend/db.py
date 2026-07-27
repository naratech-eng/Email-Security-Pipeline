"""
Postgres connection + detections persistence (M7-T15).

Fails open by design: if the DB is unreachable or DB_CREDENTIALS_JSON isn't
set (e.g. local dev without Postgres), reads/writes are skipped with a
logged warning rather than breaking /analyze/email — persisting a detection
is a record-keeping nice-to-have, not a reason to fail the actual scoring
request the caller is waiting on.
"""
import json
import os
import sys
from datetime import timedelta
from typing import Optional

import psycopg
from psycopg.rows import dict_row

_db_url: Optional[str] = None
_db_url_resolved = False


def _resolve_db_url() -> Optional[str]:
    global _db_url, _db_url_resolved
    if _db_url_resolved:
        return _db_url
    _db_url_resolved = True

    raw = os.environ.get('DB_CREDENTIALS_JSON')
    if not raw:
        return None
    try:
        creds = json.loads(raw)
        # Defensive: some AWS-provided host values (e.g. aws_db_instance's
        # .endpoint attribute) come as "host:port" already combined. Strip
        # any embedded port so it doesn't collide with the separate "port"
        # field below.
        host = str(creds['host']).split(':')[0]
        _db_url = (
            f"host={host} port={creds['port']} "
            f"dbname={creds['dbname']} user={creds['username']} "
            f"password={creds['password']}"
        )
    except Exception as e:
        sys.stderr.write(f"db: could not parse DB_CREDENTIALS_JSON: {e}\n")
        _db_url = None
    return _db_url


_INSERT_SQL = """
INSERT INTO detections (
    source, submitted_by, submitted_by_sub, verdict, likelihood, summary, remediation,
    from_addr, to_addr, subject, email_date, num_urls, attachment_count,
    email_score, email_model, email_reason, email_features, urls
) VALUES (
    %(source)s, %(submitted_by)s, %(submitted_by_sub)s, %(verdict)s, %(likelihood)s, %(summary)s, %(remediation)s,
    %(from_addr)s, %(to_addr)s, %(subject)s, %(email_date)s, %(num_urls)s, %(attachment_count)s,
    %(email_score)s, %(email_model)s, %(email_reason)s, %(email_features)s, %(urls)s
)
RETURNING id
"""


def insert_detection(row: dict) -> Optional[int]:
    url = _resolve_db_url()
    if not url:
        sys.stderr.write("db: DB_CREDENTIALS_JSON not set, skipping detection write\n")
        return None
    try:
        params = dict(row)
        # Older callers don't pass the immutable-identity column; the schema
        # allows NULL there, so default rather than KeyError on them.
        params.setdefault('submitted_by_sub', None)
        params['email_features'] = (
            json.dumps(row['email_features']) if row.get('email_features') is not None else None
        )
        params['urls'] = json.dumps(row.get('urls', []))
        with psycopg.connect(url, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(_INSERT_SQL, params)
                new_id = cur.fetchone()[0]
            conn.commit()
        return new_id
    except Exception as e:
        sys.stderr.write(f"db: failed to write detection, continuing without persistence: {e}\n")
        return None


def list_detections(
    source: Optional[str] = None,
    verdict: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list:
    url = _resolve_db_url()
    if not url:
        return []

    clauses = []
    params = {'limit': limit, 'offset': offset}
    if source:
        clauses.append("source = %(source)s")
        params['source'] = source
    if verdict:
        clauses.append("verdict = %(verdict)s")
        params['verdict'] = verdict
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    sql = f"""
        SELECT id, created_at, source, submitted_by, verdict, likelihood, summary, remediation,
               from_addr, to_addr, subject, email_date, num_urls, attachment_count,
               email_score, email_model, email_reason, email_features, urls
        FROM detections
        {where}
        ORDER BY created_at DESC
        LIMIT %(limit)s OFFSET %(offset)s
    """
    try:
        with psycopg.connect(url, connect_timeout=5) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        for r in rows:
            r['created_at'] = r['created_at'].isoformat()
            r['likelihood'] = float(r['likelihood'])
        return rows
    except Exception as e:
        sys.stderr.write(f"db: failed to list detections: {e}\n")
        return []


# --------------------------------------------------------------------------- #
# Overview aggregates (M7-T16, slice 6).
#
# The dashboard's Overview wall needs totals, a verdict split, and a trend
# series. None of those can be derived honestly from list_detections(): it
# returns the N most recent rows, so every proportion computed from it is
# biased toward whatever just happened, and there is no way to obtain a count.
#
# Three cheap statements on one connection rather than one clever query: the
# bounds are resolved first so the aggregates can bind a real timestamp and
# use ix_detections_created_at, instead of a cross join that would scan the
# whole table.
# --------------------------------------------------------------------------- #

# The window is rounded OUT to a bucket boundary so every bucket in `series`
# is a whole one (bar the in-progress final bucket) and sum(series) == total.
# `window_start` goes back to the caller, so the label can state the real span
# rather than implying an exact N hours.
_BOUNDS_SQL = """
SELECT now() AS generated_at,
       date_trunc(%(unit)s, now() - make_interval(hours => %(window_hours)s)) AS window_start
"""

# `newest_at` / `newest_server_at` are deliberately NOT window-bounded: a
# windowed MAX() returns NULL precisely when the mail pipeline has been quiet
# longer than the window, which is the one case the dashboard's "quiet" rule
# exists to detect. They answer "when did we last see one, ever".
_STATS_SQL = """
SELECT
    count(*) FILTER (WHERE created_at >= %(since)s)                                  AS total,
    count(*) FILTER (WHERE created_at >= %(since)s AND verdict = 'clean')            AS v_clean,
    count(*) FILTER (WHERE created_at >= %(since)s AND verdict = 'flag')             AS v_flag,
    count(*) FILTER (WHERE created_at >= %(since)s AND verdict = 'quarantine')       AS v_quarantine,
    count(*) FILTER (WHERE created_at >= %(since)s AND source = 'server')            AS s_server,
    count(*) FILTER (WHERE created_at >= %(since)s AND source = 'upload')            AS s_upload,
    max(created_at)                                                                  AS newest_at,
    max(created_at) FILTER (WHERE source = 'server')                                 AS newest_server_at
FROM detections
"""

# Absolute wall-clock buckets, never relative to "now" — poll-relative edges
# would shift every 30s and make the chart appear to move without new data.
_SERIES_SQL = """
SELECT date_trunc(%(unit)s, created_at) AS bucket_start, count(*) AS count
FROM detections
WHERE created_at >= %(since)s
GROUP BY 1
ORDER BY 1
"""


def detection_stats(window_hours: int = 24) -> Optional[dict]:
    """
    Aggregates for the Overview wall over the last `window_hours`.

    Returns None — not zeros — when the database can't be reached, because the
    two states mean different things to an analyst: `total: 0` says "we looked
    and found none", while None says "we don't know". Rendering an outage as a
    quiet night is exactly the fabrication the wall must avoid.
    """
    url = _resolve_db_url()
    if not url:
        sys.stderr.write("db: DB_CREDENTIALS_JSON not set, skipping detection stats\n")
        return None

    # Hourly buckets get unreadable past a couple of days (7d would be 168
    # points), so the granularity follows the window.
    unit = 'hour' if window_hours <= 48 else 'day'
    step = timedelta(hours=1) if unit == 'hour' else timedelta(days=1)

    try:
        with psycopg.connect(url, connect_timeout=5) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(_BOUNDS_SQL, {'unit': unit, 'window_hours': window_hours})
                bounds = cur.fetchone()
                generated_at, since = bounds['generated_at'], bounds['window_start']

                cur.execute(_STATS_SQL, {'since': since})
                agg = cur.fetchone()

                cur.execute(_SERIES_SQL, {'unit': unit, 'since': since})
                buckets = {r['bucket_start']: r['count'] for r in cur.fetchall()}
    except Exception as e:
        sys.stderr.write(f"db: failed to read detection stats: {e}\n")
        return None

    # Zero-fill: without it, an empty hour is simply absent and the axis
    # compresses, so a quiet night renders as continuous activity.
    series = []
    cursor_at = since
    while cursor_at <= generated_at:
        series.append({
            'bucket_start': cursor_at.isoformat(),
            'count': buckets.get(cursor_at, 0),
        })
        cursor_at += step

    return {
        'window_hours': window_hours,
        'window_start': since.isoformat(),
        'bucket_unit': unit,
        'generated_at': generated_at.isoformat(),
        'total': agg['total'],
        'by_verdict': {
            'clean': agg['v_clean'],
            'flag': agg['v_flag'],
            'quarantine': agg['v_quarantine'],
        },
        'by_source': {
            'server': agg['s_server'],
            'upload': agg['s_upload'],
        },
        'series': series,
        'newest_at': agg['newest_at'].isoformat() if agg['newest_at'] else None,
        'newest_server_at': (
            agg['newest_server_at'].isoformat() if agg['newest_server_at'] else None
        ),
        # No review column exists yet (no schema, write path, read path, or
        # endpoint), so this is null rather than 0 — the tile stays hidden on a
        # real signal, and lights up on its own once persistence lands.
        'reviewed': None,
    }
