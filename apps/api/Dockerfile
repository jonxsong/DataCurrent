FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY apps/api/pyproject.toml apps/api/pyproject.toml
COPY workers/collector/pyproject.toml workers/collector/pyproject.toml
RUN uv sync --frozen --no-dev --package datacurrent-api --package datacurrent-collector

COPY apps/api apps/api
COPY workers/collector workers/collector
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/apps/api:/app/workers/collector"
WORKDIR /app/apps/api

RUN useradd --create-home --uid 10001 datacurrent && chown -R datacurrent:datacurrent /app
USER datacurrent

EXPOSE 8000
CMD ["uvicorn", "datacurrent.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
