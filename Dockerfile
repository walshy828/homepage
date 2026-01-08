# Build stage
FROM python:3.11-slim as builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /build/wheels -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Prevent Python from buffering stdout and stderr
ENV PYTHONUNBUFFERED=1

# Install runtime dependencies including Chromium (for dependencies) and fonts
# Add PostgreSQL 18 repository for latest pg_dump/psql tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    lsb-release \
    && echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg \
    && apt-get update && apt-get install -y --no-install-recommends --fix-missing \
    chromium \
    postgresql-client-18 \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libx11-xcb1 \
    libxss1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/* \
    && (groupadd -g 999 docker || groupadd docker) \
    && useradd -m -u 1000 -G docker appuser

# Copy wheels from builder and install
COPY --from=builder /build/wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Install Playwright browsers (binary only, as deps are installed above)
RUN playwright install chromium


# Copy application code
COPY backend/alembic.ini .
COPY backend/alembic ./alembic
COPY backend/app ./app
COPY frontend ./static

# Create data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# USER appuser (Commented out to allow access to /var/run/docker.sock)

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
