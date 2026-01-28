# JM Showroomer API v1

Backend API for mobile (Flutter) and web clients.

---

## Base URL

The base URL for all API requests is:

`https://<BACKEND_URL>/api/v1`

For example, for health check:

`GET https://<BACKEND_URL>/api/v1/health`

---

## Authentication

- Google OAuth via Firebase
- Apple OAuth — planned (not implemented)

**Header for protected endpoints:**

`Authorization: Bearer <ID_TOKEN>`

Where `<ID_TOKEN>` is the Firebase token received after Google Sign-In.

---

## Registration & Login Flow

1. Login via Google OAuth → obtain `idToken`
2. Fetch user profile: `GET /users/me` with `Authorization` header
3. Request OWNER role (cannot assign manually): `POST /users/request-owner`
   - Wait for `"pending"` status
   - Backend approves OWNER role later

---

## Endpoints & Roles

| Type      | Endpoints                                                                     | Notes                           |
| --------- | ----------------------------------------------------------------------------- | ------------------------------- |
| Public    | `/health`, `/showrooms`, `/lookbooks`                                         | No token required               |
| Auth      | `/auth/oauth`, `/auth/apple`                                                  | Authentication endpoints        |
| Protected | `/users/me`, `/users/request-owner`, `/showrooms/create`, `/lookbooks/create` | Requires `Authorization` header |
| Dev-only  | `/users/dev/register-test`                                                    | For testing                     |

---

## Roles & Rules

| Role    | Description                     |
| ------- | ------------------------------- |
| GUEST   | Unauthenticated user            |
| USER    | Default authenticated user      |
| OWNER   | Business owner (after approval) |
| ADMIN   | Internal admin                  |
| MANAGER | Future role                     |
| STYLIST | Future role                     |

**Rules:**

- GUEST: browse only
- USER: default after login
- USER can request OWNER role
- OWNER permissions enabled only after approval

---

## Errors

- 401 AUTH_MISSING — Missing token
- 401 AUTH_INVALID — Invalid/expired token
- 403 FORBIDDEN — Role not allowed
- 404 USER_NOT_FOUND — Profile missing
- 400 — Validation error
- 500 — Server error

---

## Flutter Notes

- Always call `GET /users/me` after login
- Never assume role locally
- Handle `"pending"` status for OWNER requests
- Use `idToken` in all protected requests

---

## Onboarding endpoints

**Auth & Onboarding Flow (Flutter)**

**Environments:**

- **DEV** — mock user (`dev-test-user-123`) works without Firestore. `onboardingState` and `request-owner` flows are mocked. Use `TEST_ID_TOKEN` for protected endpoints.
- **STAGE** — requires real Firebase token; behavior same as PROD for auth and RBAC.
- **PROD** — requires real Firebase token; public endpoints available without token.

**Endpoints & Roles:**  
| Scope | Method | Endpoint | Roles / Notes |
| ----- | --------- | ------------------------------- | ---------------------------------------------------------------------- |
| TRUE | Protected | GET /users/me | Returns user profile including `onboardingState` (`new` / `completed`) |
| TRUE | Protected | POST /users/complete-onboarding | Marks onboarding as completed (`onboardingState = completed`) |
| TRUE | Protected | POST /users/request-owner | Requests OWNER role; in DEV mock returns `"pending_owner"` immediately |
| TRUE | Dev-only | POST /users/dev/register-test | Creates a test user |

**Roles & Permissions:**

- `GUEST` — unauthenticated, browse only
- `USER` — default after login; can request OWNER
- `OWNER` — business user; can create showrooms and lookbooks
- `ADMIN`, `MANAGER`, `STYLIST` — future roles

**Flutter Notes:**

1. Always fetch `GET /users/me` after login to get current `onboardingState`.
2. Do not assume onboarding is completed locally.
3. Call `POST /users/complete-onboarding` when onboarding is finished.
4. Use `idToken` in all protected requests.
5. DEV mock returns `"pending_owner"` for OWNER requests for UI testing without Firestore.
6. `onboardingState` is linked to roles but does not change permissions directly.

---

## Showroom CRUD – Backend

- **Firebase Firestore** integrated
- **Create showroom** (`POST /showrooms`) – OWNER only
- **List showrooms** (`GET /showrooms`) – public
- **Get showroom by ID** (`GET /showrooms/{id}`) – protected for owner/admin, public if status=approved
- **Update showroom** (`PATCH /showrooms/{id}`) – OWNER only (draft/rejected)
- **Favorite showroom** (`POST /showrooms/:id/favorite`) – protected, stub

### Validation rules

- **Unique name** per owner
- **Blocked countries**: Russia, Belarus
- **Edit tracking**: `editCount`, `editHistory` with editor UID, role, timestamp
- **Null-safe fields**: `contacts`, `location`

### Roles

| Role  | Permissions                               |
| ----- | ----------------------------------------- |
| OWNER | Create, update showrooms (draft/rejected) |
| USER  | Browse only                               |
| ADMIN | Internal / moderation (future)            |
| GUEST | Unauthenticated, browse only              |
