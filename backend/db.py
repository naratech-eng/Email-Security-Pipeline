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
    source, submitted_by, verdict, likelihood, summary, remediation,
    from_addr, to_addr, subject, email_date, num_urls, attachment_count,
    email_score, email_model, email_reason, email_features, urls
) VALUES (
    %(source)s, %(submitted_by)s, %(verdict)s, %(likelihood)s, %(summary)s, %(remediation)s,
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
