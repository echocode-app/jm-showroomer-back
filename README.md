# JM Showroomer Backend

Backend API for JM Showroomer clients. Focus: authentication, showroom lifecycle, moderation, and geo search.

## Overview
- Base path: `/api/v1`
- Auth: Firebase ID tokens (Bearer)
- Data: Firestore + Storage
- Docs: OpenAPI (`/docs`, `docs/openapi.yaml`)

## Core Features
- **Auth + RBAC**: guest / user / owner / admin
- **Showrooms**: draft → pending → approved / rejected → deleted
- **Geo model (MVP1)**: `geo` (city + coords + geohash), filter by `?city=`
- **Moderation**: submit + admin approve/reject
- **Pending lock**: no edits while `pending`
- **Country rules**: RU/BY blocked, showroom country must match owner
- **Anti‑duplicate**: owner + global checks
- **Audit**: edit history with diffs
- **Soft delete**: hidden from public/owner lists

## UI‑Relevant Errors
- `USER_COUNTRY_CHANGE_BLOCKED` (409)
- `SHOWROOM_LOCKED_PENDING` (409)

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
