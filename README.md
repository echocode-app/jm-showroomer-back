# JM Showroomer Backend

[![CI](https://github.com/echocode-app/jm-showroomer-back/actions/workflows/ci.yml/badge.svg)](https://github.com/echocode-app/jm-showroomer-back/actions/workflows/ci.yml)

## Project Overview

Backend API for JM Showroomer mobile clients (Flutter), covering authentication, catalog browsing, showroom moderation lifecycle, collections/favorites sync, notifications, and analytics ingest.

Base API path: `/api/v1`

## Architecture Overview

- `src/core` — app bootstrap, config, error handling
- `src/routes` — HTTP route composition
- `src/controllers` — request/response layer
- `src/services` — business logic and Firestore access
- `src/middlewares` — auth, validation, rate limit, logging context
- `src/schemas` — request validation schemas
- `src/utils` — shared helpers (logging governance, response helpers, normalization)
- `docs/` — modular OpenAPI + integration docs

## Tech Stack

- Node.js (ESM) + Express
- Firebase Admin SDK (Auth / Firestore / Storage)
- Joi validation
- Pino / pino-http logging
- OpenAPI 3.0 (modular YAML)
- Jest (unit) + Bash/curl integration suites

## API Overview

Main domains:

- Auth (`/auth/oauth`)
- Users / onboarding / notifications / devices (`/users/*`)
- Showrooms (`/showrooms*`)
- Lookbooks (`/lookbooks*`)
- Events (`/events*`)
- Collections sync (`/collections/*`)
- Admin moderation (`/admin/showrooms/*`)
- Analytics ingest (`/analytics/ingest`)

Canonical OpenAPI entrypoint: `docs/openapi.yaml`

## Logging & Observability (Short)

- Structured request logging via `pino-http`
- Structured domain logs with governance (`domain/event/status`, catalog + enum enforcement)
- Duplicate protection for error flows (`err.__domainLogged`)
- System logs for rate limit and `INDEX_NOT_READY`
- Logging is contract-safe (does not change API responses)

See: `docs/readme/README_DETAIL.md`

## Analytics (Short)

- Backend-generated analytics for key state transitions and views
- Client analytics ingest via `/analytics/ingest`
- Ingest hardening includes whitelist validation and payload sanitization
- Analytics is best-effort and must not block business flows

See: `docs/readme/ANALYTICS_CONTRACT.md`

## Getting Started

```bash
npm install
npm run dev
```

Environment files:

- `.env.dev`
- `.env.test`
- `.env.prod`

## Documentation Links

- `docs/openapi.yaml` — OpenAPI spec (modular entrypoint)
- `docs/readme/README_DETAIL.md` — detailed backend + Flutter contract
- `docs/readme/ANALYTICS_CONTRACT.md` — analytics contract and client responsibilities
- `docs/readme/SHOWROOMS_MVP1_SEARCH.md` — showroom search / geo / cursor rules
- `docs/readme/DEV.md` — developer runbook (tests / release)
- `docs/readme/DEV_POSTMAN_TESTS.md` — manual API verification scenarios
- `docs/readme/README_UA.md` — business logic overview (UA)
- `docs/readme/README_BACKEND_MAP_UA.md` — backend module map (UA)

## License / Internal Use

UNLICENSED. Internal project use only unless explicitly approved by the repository owner.
