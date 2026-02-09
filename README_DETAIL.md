# JM Showroomer API v1

## Quick Start (Flutter)

1. Firebase Sign-In (Google/Apple/any) → get Firebase `idToken`.
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
- Lookbooks and events are standalone entities (no showroom linkage or geo inheritance).
- Profile settings: `PATCH /users/profile` (name/country/instagram/position/settings).
  - Owner country change is blocked if there are active showrooms/lookbooks/events → `409 USER_COUNTRY_CHANGE_BLOCKED`.
- Showroom country must match owner country; changing it to a different country is blocked on PATCH/submit.

Required fields for submit:  
`name`, `type`, `country`, `address`, `city`, `availability`, `contacts.phone`, `contacts.instagram`, `location.lat`, `location.lng`.

## Geo model (MVP1)

The client provides geo data; the backend does **not** geocode or call Google APIs.
Send `geo` during draft PATCH or create; backend computes `cityNormalized` and `geohash`.

Geo payload example:

```json
{
  "geo": {
    "city": "Kyiv",
    "country": "Ukraine",
    "coords": { "lat": 50.4501, "lng": 30.5234 },
    "placeId": "ChIJBUVa4U7P1EAR_kYBF9IxSXY"
  }
}
```

Rules:
- Send only `geo.city`, `geo.country`, `geo.coords`, `geo.placeId`.
- Do **not** send `cityNormalized` or `geohash` (backend fills them).
- `geo` is optional for drafts/legacy records.
- `geo` is updated as a whole object (no partial or null removal).
- `country` uses full name (e.g., `Ukraine`), **not** ISO2.

Search by city (public): `GET /showrooms?city=Kyiv`  
Filter uses normalized city on backend (`geo.cityNormalized`).

Response includes:
`geo.cityNormalized` (lowercase/trimmed) and `geo.geohash` (precision 9).

Location vs Geo:
- `location` is legacy address coordinates.
- `geo.coords` is the canonical geo used for search.

Possible Firestore index:
If combining `city` with other filters (e.g., `status`, `ownerUid`), Firestore may require a composite index.

## Showroom Search & Pagination

Query params:
- `limit`: 1..100, default 20
- `fields`: `marker` or `card`
- `q`: prefix search by `nameNormalized` (ignored when `city` is set or `qMode=city`)
- `qMode`: `city` or `name` (forces how `q` is interpreted)
- `city`: exact match on `geo.cityNormalized`
- `brand`: exact match on `brandsNormalized`
- `category` or `categories`
- `geohashPrefix` or `geohashPrefixes[]`
- `cursor`: base64 JSON with version `v`

Cursor limitations:
- Cursor works only with a single `geohashPrefix`.
- Cursor is not supported for `geohashPrefixes[]`.
- Cursor is not supported for `geohashPrefix + q`.

Validation errors:
- `QUERY_INVALID`
- `CURSOR_INVALID`

Search implementation:
- `src/services/showrooms/listShowrooms.js` (entry)
- `src/services/showrooms/list/` (parse/utils/ordering/dev/firestore)

## Base URL

`https://<BACKEND_URL>/api/v1`

## Media/Storage (MVP1)

- Media paths are canonical storage paths (e.g., `lookbooks/{id}/cover/{file}.webp`).
- Clients receive short‑lived signed URLs (e.g., `coverUrl`) for read access (TTL 6h).
- Upload is MVP2; MVP1 uses seeded content only.

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
| Auth        | POST   | /auth/oauth                   | Public. Login via Firebase ID token (Google/Apple/any).                                 |
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
| Lookbooks   | GET    | /lookbooks                    | Public. Seeded content (MVP1).                                                          |
| Lookbooks   | POST   | /lookbooks/create             | OWNER/MANAGER. Stub (MVP2).                                                             |
| Lookbooks   | POST   | /lookbooks/{id}/rsvp          | Authenticated users. Stub.                                                              |
| Events      | POST   | /events/{id}/rsvp             | Authenticated users. Stub.                                                              |
| Collections | GET    | /collections/favorites/showrooms | Public/any role. Stub (empty list).                                                 |
| Collections | GET    | /collections/favorites/lookbooks | Public/any role. Stub (empty list).                                                 |
| Collections | GET    | /collections/want-to-visit/events | Public/any role. Stub (empty list).                                                |
| Dev         | POST   | /users/dev/register-test       | Dev/Test only. Creates mock user (not in OpenAPI).                                     |
| Dev         | POST   | /users/dev/make-owner          | Dev/Test only. Upgrades current user to owner (not in OpenAPI).                       |
