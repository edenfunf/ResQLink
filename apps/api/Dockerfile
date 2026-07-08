FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a dedicated non-root user (the app writes nothing to the filesystem).
RUN useradd --create-home --shell /usr/sbin/nologin appuser
USER appuser

EXPOSE 8000

# Migrations are idempotent, so running them on every start is safe.
# PORT is honoured for managed hosts (Render sets it); defaults to 8000 locally.
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
