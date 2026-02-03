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
- Profile settings: `PATCH /users/profile` (name/country/instagram/position/settings).
  - Owner country change is blocked if there are active showrooms/lookbooks/events → `409 USER_COUNTRY_CHANGE_BLOCKED`.

Required fields for submit:  
`name`, `type`, `country`, `address`, `city`, `availability`, `contacts.phone`, `contacts.instagram`, `location.lat`, `location.lng`.

## Base URL

`https://<BACKEND_URL>/api/v1`

## Error Handling (Flutter)

- 401 `AUTH_MISSING` / `AUTH_INVALID` → re-login
- 403 `FORBIDDEN` → no permission
- 403 `COUNTRY_BLOCKED` → russia or belarus
- 409 `USER_COUNTRY_CHANGE_BLOCKED` → owner has active showrooms/lookbooks/events
- 400 validation → show message from `error`

## Endpoints (essentials)

- `GET /users/me`
- `POST /users/complete-onboarding`
- `POST /users/complete-owner-profile`
- `PATCH /users/profile`
- `POST /showrooms/draft`
- `PATCH /showrooms/{id}`
- `POST /showrooms/{id}/submit`
- `DELETE /showrooms/{id}`

## Admin moderation

- `POST /admin/showrooms/{id}/approve`
- `POST /admin/showrooms/{id}/reject` (body: `{ reason: string }`)
- `DELETE /admin/showrooms/{id}` (soft delete any)

---

API Table (actual)

| Scope       | Method | Endpoint                      | Roles / Notes                                                                           |
| ----------- | ------ | ----------------------------- | --------------------------------------------------------------------------------------- |
| Health      | GET    | /health                       | Public. Service health check.                                                           |
| Auth        | POST   | /auth/oauth                   | Public. Firebase ID token (Google OAuth).                                               |
| Auth        | POST   | /auth/apple                   | Public. Stub (501).                                                                     |
| Users       | GET    | /users/me                     | Authenticated only. Returns current profile.                                            |
| Users       | POST   | /users/complete-onboarding    | Authenticated only. Finishes onboarding flow.                                           |
| Users       | POST   | /users/complete-owner-profile | USER/OWNER. Upgrades to OWNER; requires schema validation.                              |
| Users       | PATCH  | /users/profile                | Authenticated. Update profile; owner country change blocked with active assets.         |
| Showrooms   | GET    | /showrooms                    | Public: approved only. OWNER: own (excludes deleted). ADMIN: all; can filter by status. |
| Showrooms   | POST   | /showrooms/create             | OWNER/MANAGER. Creates showroom. `?mode=draft` to create draft.                         |
| Showrooms   | POST   | /showrooms/draft              | OWNER only. Create/reuse draft.                                                         |
| Showrooms   | GET    | /showrooms/{id}               | Public for approved; OWNER/ADMIN for own/any (incl pending/deleted).                    |
| Showrooms   | PATCH  | /showrooms/{id}               | OWNER only (own). Draft/rejected/approved; blocked while pending.                       |
| Showrooms   | DELETE | /showrooms/{id}               | OWNER only (own). Soft delete; blocked while pending.                                   |
| Showrooms   | POST   | /showrooms/{id}/submit        | OWNER only (own). Draft/rejected/approved → pending.                                    |
| Showrooms   | POST   | /showrooms/{id}/favorite      | Authenticated users. Stub.                                                              |
| Admin       | GET    | /admin/showrooms              | ADMIN only. List all (incl pending/deleted).                                            |
| Admin       | GET    | /admin/showrooms/{id}         | ADMIN only. Get any showroom (incl deleted).                                            |
| Admin       | POST   | /admin/showrooms/{id}/approve | ADMIN only. Pending → approved.                                                         |
| Admin       | POST   | /admin/showrooms/{id}/reject  | ADMIN only. Pending → rejected (body: { reason }).                                      |
| Admin       | DELETE | /admin/showrooms/{id}         | ADMIN only. Soft delete any status.                                                     |
| Lookbooks   | GET    | /lookbooks                    | Public. Stub.                                                                           |
| Lookbooks   | POST   | /lookbooks/create             | OWNER/MANAGER. Stub.                                                                    |
| Lookbooks   | POST   | /lookbooks/{id}/rsvp          | Authenticated users. Stub.                                                              |
| Collections | GET    | /collections/favorites/showrooms | Public/any role. Stub (empty list).                                                 |
| Collections | GET    | /collections/favorites/lookbooks | Public/any role. Stub (empty list).                                                 |
| Collections | GET    | /collections/want-to-visit/events | Public/any role. Stub (empty list).                                                |
