# JM Showroomer Backend

[![CI](https://github.com/echocode-app/jm-showroomer-back/actions/workflows/ci.yml/badge.svg)](https://github.com/echocode-app/jm-showroomer-back/actions/workflows/ci.yml)
[![Smoke Tests (Manual)](https://github.com/echocode-app/jm-showroomer-back/actions/workflows/smoke.yml/badge.svg)](https://github.com/echocode-app/jm-showroomer-back/actions/workflows/smoke.yml)

Backend API for JM Showroomer clients. Focus: authentication, showroom lifecycle, moderation, and geo search.

## Overview
- Base path: `/api/v1`
- Auth: Firebase ID tokens (Bearer)
- Data: Firestore + Storage
- Docs: OpenAPI (`/docs`, `docs/openapi.yaml`)

## Core Features
- **Auth + RBAC**: guest / user / owner / admin
- **Showrooms**: draft → pending → approved / rejected → deleted
- **Geo model (MVP1)**: `geo` (city + country + coords + geohash), filter by `?city=`
- **Lookbooks & Events**: standalone entities (MVP1: seeded lookbooks, events RSVP stub)
- **Moderation**: submit + admin approve/reject
- **Pending lock**: no edits while `pending`
- **Country rules**: RU/BY blocked, showroom country must match owner
- **Anti‑duplicate**: owner + global checks
- **Audit**: edit history with diffs
- **Soft delete**: hidden from public/owner lists
- **User delete (MVP1)**: soft-delete profile, PII nulling; owner blocked if they have any showrooms/assets

## Search & Pagination (Showrooms)
- `limit`: 1..100, default 20
- `fields`: `marker` or `card`
- `q`: prefix search by `nameNormalized` (ignored when `city` is set or `qMode=city`)
- `city`: exact match on `geo.cityNormalized`
- `brand`: exact match on `brandsMap.<brandKey>`
- `categoryGroup`
- `subcategories` (array-contains-any)
- `geohashPrefix` or `geohashPrefixes[]`
- `cursor`: base64 JSON (v2) with fields `{v,f,d,value,id}`

Pagination contract (backend-owned):
- Client must only follow `meta.nextCursor`; no client-side merging/deduping.
- `meta.paging` values: `enabled` (more pages), `end` (no more results), `disabled` (paging unsupported).
- Cursor works only with a single `geohashPrefix`.
- Cursor is not supported for `geohashPrefixes[]` (returns `paging=disabled`).
- `geohashPrefix(es) + q` is rejected as `QUERY_INVALID`.

Validation errors:
- `QUERY_INVALID`
- `CURSOR_INVALID`

Search implementation:
- `src/services/showrooms/listShowrooms.js` (entry)
- `src/services/showrooms/list/` (parse/utils/ordering/dev/firestore)

## Suggestions & Counters
- `GET /showrooms/suggestions`: lightweight search hints.
- `GET /showrooms/counters`: total count by current filters.
- `suggestions`: `q` is required; `q.length < 2` returns `[]`.
- `suggestions`: geo params are not supported.
- `counters`: `q` is optional; `cursor/fields/limit` are rejected.
- `counters`: `geohashPrefix(es) + q` is rejected as `QUERY_INVALID`.

Deploy note: run `firebase deploy --only firestore:indexes` for test/stage/prod before integration tests or releases.

## UI‑Relevant Errors
- `USER_COUNTRY_CHANGE_BLOCKED` (409)
- `SHOWROOM_LOCKED_PENDING` (409)
- `USER_DELETE_BLOCKED` (409)

## Tech Stack
- Node.js (ESM), Express
- Firebase Admin SDK (Auth, Firestore, Storage)
- Joi validation
- OpenAPI 3.0 (modular YAML)
- Bash tests (curl + jq)

## Repository Map
```
src/
  core/        app bootstrap + error handling
  routes/      API routing + RBAC
  controllers/ thin HTTP layer
  services/    business logic + Firestore
  middlewares/ auth, validation, country guards
  utils/       normalization + helpers
  schemas/     Joi schemas
  constants/   enums + country block list
  test/        bash tests
docs/          OpenAPI specs (modular)
```

## Common Commands
```bash
npm i
npm run dev
```

## CI Overview
- `ci.yml` runs unit tests (Jest), OpenAPI lint, and shellcheck. No secrets required.
- `smoke.yml` is manual (workflow_dispatch) for integration tests after deploy. Provide `BASE_URL` and set repo secrets (`TEST_USER_TOKEN`, `TEST_ADMIN_TOKEN`) if you want to run showrooms/admin tests. Missing secrets will skip those steps gracefully.

Deploy note: run `firebase deploy --only firestore:indexes` for test/stage/prod before integration tests or releases.

## Firestore Indexes (Manual Deploy)
- Workflow: `.github/workflows/firestore-indexes.yml` (manual only).
- Required secrets: `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID`.
- Command: `firebase deploy --only firestore:indexes --project "$FIREBASE_PROJECT_ID"`.
- Current Firebase is corporate; later will be switched to client project.
