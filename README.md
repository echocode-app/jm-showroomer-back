# JM Showroomer Backend

[![CI](https://github.com/echocode-app/jm-showroomer-back/actions/workflows/ci.yml/badge.svg)](https://github.com/echocode-app/jm-showroomer-back/actions/workflows/ci.yml)
[![Smoke Tests (Manual)](https://github.com/echocode-app/jm-showroomer-back/actions/workflows/smoke.yml/badge.svg)](https://github.com/echocode-app/jm-showroomer-back/actions/workflows/smoke.yml)

Backend API for JM Showroomer mobile clients.

## What This Service Does
- Firebase-based authentication and role-aware access (`guest`, `user`, `owner`, `admin`)
- Showroom lifecycle: draft -> moderation -> approved/rejected -> soft delete
- Public catalogs: showrooms, lookbooks, events
- Favorites/collections flows (including guest-to-auth sync where supported)
- Validation, moderation rules, and Firestore-backed search/pagination

Base API path: `/api/v1`  
API docs: `/docs` and `docs/openapi.yaml`

## Tech Stack
- Node.js (ESM), Express
- Firebase Admin SDK (Auth, Firestore, Storage)
- Joi validation
- OpenAPI 3.0 (modular YAML)
- Bash tests (curl + jq)

## Minimal Project Map
```
src/
  core/         app bootstrap + global error handling
  routes/       endpoints
  middlewares/  auth/roles/validation
  controllers/  HTTP layer
  services/     business logic + Firestore access
  schemas/      request validation
  test/         integration bash suites
docs/           OpenAPI specs
docs/readme/    integration and dev runbooks
```

## Run Locally
```bash
npm i
npm run dev
```

## Environment Variables
Use `.env.dev`, `.env.test`, `.env.prod` (see `.env.example`).

Required base keys:
- `NODE_ENV`
- `BASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `PUSH_ENABLED` (`true` to enable FCM sends; defaults to disabled)

For integration tests:
- `TEST_USER_TOKEN`
- `TEST_ADMIN_TOKEN`
- `TEST_OWNER_TOKEN_2`

## Useful Commands
```bash
# unit
npm run test:unit -- --watchman=false

# core integration suites
npm run test:smoke
npm run test:showrooms
npm run test:lookbooks
npm run test:all
```

## Documentation Index
- `docs/readme/README_UA.md` — simple business-level overview (UA)
- `docs/readme/README_DETAIL.md` — Flutter integration contract
- `docs/readme/SHOWROOMS_MVP1_SEARCH.md` — showroom search integration
- `docs/readme/DEV.md` — developer runbook (tests/release)
- `docs/readme/DEV_POSTMAN_TESTS.md` — manual API checks in Postman
- `docs/readme/README_BACKEND_MAP_UA.md` — technical backend map (UA)
