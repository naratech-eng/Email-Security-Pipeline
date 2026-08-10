FROM python:3.14-slim

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/main.py backend/main.py
COPY backend/inference.py backend/inference.py
COPY backend/mime_parser.py backend/mime_parser.py
COPY backend/db.py backend/db.py
COPY backend/retention_purge.py backend/retention_purge.py
COPY backend/cognito_auth.py backend/cognito_auth.py
COPY backend/alembic.ini backend/alembic.ini
COPY backend/migrations backend/migrations
COPY notebooks/M4/m4_t3_url_features.py notebooks/M4/m4_t3_url_features.py

RUN useradd --create-home --shell /bin/false appuser \
    && chown -R appuser:appuser /app
USER appuser

WORKDIR /app/backend

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()" || exit 1

# RDS is private-subnet-only (not reachable from GitHub Actions), so the
# M7-T15 detections-table migration runs here at container startup instead
# of in CI. Non-fatal on failure (matches db.py's fail-open design elsewhere
# — a migration hiccup shouldn't take down email/URL scoring, only detection
# persistence).
CMD ["sh", "-c", "alembic upgrade head || echo 'WARNING: alembic migration failed, starting anyway'; exec uvicorn main:app --host 0.0.0.0 --port 8000"]
