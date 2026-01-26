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

---

| Scope | Method    | Endpoint                        | Roles / Notes                                                          |
| ----- | --------- | ------------------------------- | ---------------------------------------------------------------------- |
| TRUE  | Protected | POST /users/complete-onboarding | Marks onboarding as completed (`onboardingState = completed`)          |
| TRUE  | Protected | GET /users/me                   | Returns user profile including `onboardingState` (`new` / `completed`) |

---

## Flutter Notes

1. Always fetch `/users/me` after login to get current onboarding state.
2. Do not assume onboarding is completed locally.
3. Call `POST /users/complete-onboarding` when user finishes onboarding.
4. The `onboardingState` is integrated with roles but does not change role permissions.
