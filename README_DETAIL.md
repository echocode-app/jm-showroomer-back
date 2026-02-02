# JM Showroomer API v1

## Quick Start (Flutter)

1. Google Sign-In → get Firebase `idToken`.
2. `GET /users/me` with `Authorization: Bearer <ID_TOKEN>`.
3. Check `onboardingState` and `role` before protected endpoints.

Example (Dart/Flutter):

```dart
final response = await http.get(
  Uri.parse('https://<BACKEND_URL>/api/v1/users/me'),
  headers: {'Authorization': 'Bearer $idToken'},
);
```

## Core Flow (must implement)

1. Onboarding: `POST /users/complete-onboarding` with `country`.
   - blocked countries: russia, belarus → `403 COUNTRY_BLOCKED`
2. Complete owner profile (auto-upgrade): `POST /users/complete-owner-profile`.
   - required: `name`, `country`, `instagram` (position optional)
3. Draft flow (OWNER only):
   - `POST /showrooms/draft` → create/reuse draft
   - `PATCH /showrooms/{id}` → save step-by-step
   - `POST /showrooms/{id}/submit` → status becomes `pending`
   - `DELETE /showrooms/{id}` → soft delete (not allowed while pending)

Notes:
- Owner role is granted by `POST /users/complete-owner-profile`.
- Owner can edit `approved` showrooms and submit changes again.
- When status is `pending`, owner cannot PATCH/DELETE (review freeze).
- Soft delete sets status=`deleted` and hides from public/owner lists.
- Each action appends to `editHistory` with before/after diff (audit log).

Required fields for submit:  
`name`, `type`, `country`, `address`, `city`, `availability`, `contacts.phone`, `contacts.instagram`, `location.lat`, `location.lng`.

## Base URL

`https://<BACKEND_URL>/api/v1`

## Error Handling (Flutter)

- 401 `AUTH_MISSING` / `AUTH_INVALID` → re-login
- 403 `FORBIDDEN` → no permission
- 403 `COUNTRY_BLOCKED` → russia or belarus
- 400 validation → show message from `error`

## Endpoints (essentials)

- `GET /users/me`
- `POST /users/complete-onboarding`
- `POST /users/complete-owner-profile`
- `POST /showrooms/draft`
- `PATCH /showrooms/{id}`
- `POST /showrooms/{id}/submit`
- `DELETE /showrooms/{id}`

## Admin moderation

- `POST /admin/showrooms/{id}/approve`
- `POST /admin/showrooms/{id}/reject` (body: `{ reason: string }`)
- `DELETE /admin/showrooms/{id}` (soft delete any)
