# JM Showroomer Backend

Backend API for the JM Showroomer mobile and web clients. Provides authentication, onboarding, and showroom management workflows with moderation and validation rules.

## Overview
- API base path: `/api/v1`
- Auth: Firebase ID tokens
- Data: Firestore (showrooms, users), Storage for assets/tests
- Dev-hosting: Render

## Core Features
- **Authentication** via Firebase ID tokens (Bearer auth)
- **RBAC**: guest / user / owner / admin (future roles exist: manager, stylist)
- **Showroom lifecycle**: draft → pending → approved / rejected → deleted (soft delete)
- **Country restrictions**: RU/BY blocked
- **Anti‑spam & duplicates**: owner‑level and global duplicate checks
- **Moderation workflow**: submit for review, admin approval/rejection via `/admin` endpoints
- **Pending lock**: owners cannot edit/delete while status is `pending`
- **Audit history**: change log with diffs per action (patch/submit/approve/reject/delete)
- **Soft delete**: status=`deleted`, filtered from public/owner lists
- **Showroom country rule**: showroom country must match owner country (change blocked)
- **Profile settings**: `PATCH /users/profile` (country change blocked for owners with active showrooms/lookbooks/events)
- **Collections stubs**: public empty lists for favorites/visit lists to keep UI stable

## Error Notes (UI‑relevant)
- `USER_COUNTRY_CHANGE_BLOCKED` (409): owner cannot change country while having active showrooms/lookbooks/events.
- `SHOWROOM_LOCKED_PENDING` (409): owner cannot edit/delete showroom while status is `pending`.

## Tech Stack
- Node.js (ESM)
- Express
- Firebase Admin SDK (Auth, Firestore, Storage)
- Joi validation
- OpenAPI 3.0 docs (modular YAML)
- Bash E2E tests (curl + jq)

## Repository Structure
```
src/
  core/           # app bootstrap, error handling
  routes/         # API routes
  controllers/    # HTTP controllers
  services/       # domain logic
  middlewares/    # auth, RBAC, validation, country guard
  utils/          # helpers, validation
  schemas/        # Joi schemas
  constants/      # enums, country block list
  test/           # bash smoke/E2E scripts

docs/             # OpenAPI specs (modular)
```
## API Documentation
- OpenAPI spec: `docs/openapi.yaml`
- Swagger UI: `GET /docs`

## Dev‑only Endpoints (not in OpenAPI)
- `POST /users/dev/register-test`
- `POST /users/dev/make-owner`

## Deployment (Render)
- Service runs as a Render web service.
- Uses environment variables and Firebase Admin credentials.
- Ensure `NODE_ENV=prod` on production instance.

## Contribution Workflow
1. Create a feature branch.
2. Make changes with tests updated as needed.
3. Run smoke/E2E tests locally.
4. Open a PR with a concise summary and test evidence.

## Common Commands
```bash
npm run dev
npm start
```
