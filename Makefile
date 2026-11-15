.PHONY: dev up down build test test-api test-web lint format migrate seed logs

dev:
	docker compose up --build

up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

test: test-api test-web

test-api:
	docker compose run --rm api pytest

test-web:
	pnpm --filter @datacurrent/web test

lint:
	pnpm lint
	uv run ruff check .

format:
	pnpm format
	uv run ruff format .

migrate:
	docker compose run --rm api alembic upgrade head

seed:
	docker compose up -d --build demo-postgres

logs:
	docker compose logs -f --tail=200
