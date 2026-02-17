# JM Showroomer API v1
> Audience: Flutter/mobile integrators. This file is integration-oriented and API-contract focused.

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
- User delete: `DELETE /users/me` performs soft delete with PII nulling.
  - Owner deletion is blocked if the user has any showrooms/lookbooks/events → `409 USER_DELETE_BLOCKED`.
  - Deleted users get `404 USER_NOT_FOUND` on `GET /users/me`.
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
- `geo.city` and `geo.country` must be non-empty strings.
- `geo.coords.lat`/`geo.coords.lng` must be valid coordinates.
- `geo.placeId` is optional; if present it must be a non-empty string.
- Do **not** send `cityNormalized` or `geohash` (backend ignores client values and recomputes).
- `geo` is optional for drafts/legacy records.
- `geo` is updated as a whole object (no partial or null removal).
- `geo.country` must match top-level `country` (case-insensitive), otherwise 400.
- `country` uses full name (e.g., `Ukraine`), **not** ISO2.

Search by city (public): `GET /showrooms?city=Kyiv`  
Filter uses normalized city on backend (`geo.cityNormalized`).

Response includes:
`geo.cityNormalized` (lowercase/trimmed) and `geo.geohash` (precision 9).

Location vs Geo:
- `location` is legacy address coordinates.
- `geo.coords` is the canonical geo used for search.

Possible Firestore index:
If combining `city`, `categoryGroup`, `subcategories`, or `brand` with other filters (e.g., `status`, `ownerUid`),
Firestore may require a composite index. For brand filtering, indexes are needed per `brandsMap.<brandKey>`.

## Showroom Search & Pagination

Query params:
- `limit`: 1..100, default 20
- `fields`: `marker` or `card`
- `q`: prefix search by `nameNormalized` (ignored when `city` is set or `qMode=city`)
- `qMode`: `city` or `name` (forces how `q` is interpreted)
- `city`: exact match on `geo.cityNormalized`
- `brand`: exact match on `brandsMap.<brandKey>` (MVP2 client feature; API is already available)
- `category` or `categories`
- `categoryGroup`
- `subcategories` (array-contains-any)
- `geohashPrefix` or `geohashPrefixes[]`
- `cursor`: base64 JSON (v2) with fields `{v,f,d,value,id}`

Note: Showrooms from blocked countries are silently excluded from public lists.

Examples:
- `GET /showrooms?type=unique`
- `GET /showrooms?categoryGroup=clothing`
- `GET /showrooms?subcategories=dresses,suits`
- `GET /showrooms?brand=zara&subcategories=dresses`

Migration note:
If existing showrooms lack `brandsMap`, run `scripts/migrate_brands_map.js` to backfill.

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
- `src/services/showrooms/list/` (parse/utils/ordering/dev/firestore + shared `devFilters.js`)

## Suggestions & Counters

Endpoints:
- `GET /showrooms/suggestions` (lightweight hints)
- `GET /showrooms/counters` (total count for current filters)

Rules:
- `suggestions`: `q` is required; `q.length < 2` returns `[]`.
- `suggestions`: geo params are not supported.
- `suggestions`: brand suggestions are API-ready, but MVP1 client can ignore them.
- `suggestions` internals are split into `src/services/showrooms/suggest/` (`dev`, `firestore`, `builders`, `constants`).
- `counters`: `q` is optional; `cursor/fields/limit` are rejected.
- `counters`: `geohashPrefix(es) + q` is rejected as `QUERY_INVALID`.
- `suggestions/counters`: `categoryGroup`, `subcategories`, `categories` are mutually exclusive (2+ → `QUERY_INVALID`).

## Events (MVP1)

- Events are standalone entities (no showroom linkage).
- Content is seeded; create/update/delete endpoints are not available in MVP1.
- Public list: `GET /events`
  - includes only `published=true` and upcoming (`startsAt >= now`)
  - past events are excluded from list
  - blocked countries are silently excluded
  - cursor shape: base64 JSON `{ v: 1, startsAt: string, id: string }`
  - `city` query is normalized server-side before matching
- Public details: `GET /events/{id}`
  - published events can be opened by direct link (including past)
  - event payload fields for MVP1 UI: `name`, `startsAt`, `endsAt`, `city`, `country`, `address`, `type`, `coverPath`, `externalUrl`
- Auth actions:
  - `POST /events/{id}/want-to-visit` (idempotent)
  - `DELETE /events/{id}/want-to-visit` (idempotent)
  - `POST /events/{id}/dismiss` (idempotent)
  - `DELETE /events/{id}/dismiss` (idempotent)
- User collections:
  - `GET /collections/want-to-visit/events` (public-compatible: guest empty, auth list)
  - returns upcoming events only (`startsAt >= now`)
  - `POST /collections/want-to-visit/events/sync` (auth required)
    - accepts guest-local state payload: `{ wantToVisitIds: [], dismissedIds: [] }`
    - max `100` ids per list (`EVENT_SYNC_LIMIT_EXCEEDED` on overflow)
    - if same id appears in both lists, want-to-visit wins
    - invalid/unpublished/blocked/past ids are skipped and returned in `skipped`
- MVP2 only:
  - `POST /events/{id}/rsvp` returns `501 EVENTS_WRITE_MVP2_ONLY`.

### Guest Event Likes Flow (MVP1)

Guests can like/dismiss events in local app storage only (no anonymous backend writes).
After login, Flutter should sync that local state once:

- `POST /collections/want-to-visit/events/sync`

Server merges the payload idempotently into user collections and returns:

- `applied.wantToVisit[]`
- `applied.dismissed[]`
- `skipped[]`

## Lookbooks (MVP1)

- Lookbooks expose full API surface, but MVP1 mobile flow is read-focused (seed/admin content + favorites/sync).
- Actor can be authenticated (`uid`) or guest (`x-anonymous-id`).
- Ownership for update/delete: `authorId === uid` OR `anonymousId === x-anonymous-id`.
- Card metadata fields (optional):
  - `author`: `{ name, position?, instagram? }`
  - `items[]`: `{ name, link }` (what is on the photo)
- Public list: `GET /lookbooks`
  - default mode: `published=true`, ordered by `createdAt desc`, optional `showroomId`
  - legacy mode still supported with `country + seasonKey`
  - supports cursor pagination with `meta.hasMore`, `meta.nextCursor`, `meta.paging`
  - signs only `coverPath` as `coverUrl`
- Public detail: `GET /lookbooks/{id}`
  - returns published lookbook for public callers
  - owner (auth/guest) can read own unpublished draft
  - signs `coverPath` and every `images[].storagePath`
- Favorites:
  - `POST /lookbooks/{id}/favorite`, `DELETE /lookbooks/{id}/favorite` are auth-only and idempotent
  - canonical likes storage: `lookbooks/{id}/likes/{actorKey}`
  - `likesCount` maintained atomically
  - authenticated calls are mirrored into `users/{uid}/lookbooks_favorites/{lookbookId}` for collections/sync compatibility
  - guest flow: keep local state in app and send it via `POST /collections/favorites/lookbooks/sync` after login
- Collections:
  - `GET /collections/favorites/lookbooks` (public-compatible: guest empty, auth list)
  - returns only existing published lookbooks; stale/unpublished ids are filtered out at read time
  - `POST /collections/favorites/lookbooks/sync` (auth required)
    - payload: `{ favoriteIds: [] }`
    - max `100` ids (`LOOKBOOK_SYNC_LIMIT_EXCEEDED` on overflow)
    - unknown/unpublished ids returned in `skipped`
    - idempotent
    - sync reconciles canonical likes (`lookbooks/{id}/likes/{u:uid}`) and updates `likesCount`
  - `x-anonymous-id` validation:
    - allowed pattern `[A-Za-z0-9_-]`, bounded length
    - invalid value -> `400 ANON_ID_INVALID`

## Firestore Index Runbook

If you see `INDEX_NOT_READY`, Firestore is missing a required composite index for the query. This is not a server crash; it means the index must be created before the query can run.

How to deploy indexes:
```bash
firebase deploy --only firestore:indexes --project "$FIREBASE_PROJECT_ID"
```

Important: brand filtering uses `brandsMap.<brandKey>`. For **new brand keys**, Firestore may require a **new composite index** that includes that specific `brandsMap.<brandKey>` field. Until it exists, queries can return `INDEX_NOT_READY`.

### Firebase Project Migration (Standardized)
When switching from corporate Firebase to owner Firebase, use the migration helper to avoid missing steps:

```bash
npm run firebase:migration -- --project <new-project-id> --env-file .env.prod
npm run firebase:migration -- --project <new-project-id> --write-firebaserc --deploy-indexes
```

Script path: `scripts/firebase_project_migration.sh`  
It validates required Firebase env keys, aligns project id, optionally updates `.firebaserc`, deploys indexes, and prints pre-prod checklist commands.

Events list index-required query shapes:
- `published + startsAt + __name__`
- `published + country + startsAt + __name__`
- `published + cityNormalized + startsAt + __name__`
- `published + country + cityNormalized + startsAt + __name__`

Lookbooks list index-required query shapes:
- `published + countryNormalized + seasonKey + sortRank + __name__`
- `published + countryNormalized + seasonKey + sortRank + publishedAt + __name__`

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
- `DELETE /users/me`
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
| Users       | GET    | /users/me                     | Authenticated only. Returns current profile. Deleted users get 404 USER_NOT_FOUND.      |
| Users       | DELETE | /users/me                     | Authenticated only. Soft delete + PII nulling; owner blocked if any assets.             |
| Users       | POST   | /users/complete-onboarding    | Authenticated only. Finishes onboarding flow.                                           |
| Users       | POST   | /users/complete-owner-profile | USER/OWNER. Upgrades to OWNER; requires schema validation.                              |
| Users       | PATCH  | /users/profile                | Authenticated. Update profile; owner country change blocked with active assets.         |
| Showrooms   | GET    | /showrooms                    | Public: approved only. OWNER: own (excludes deleted). ADMIN: all; can filter by status. |
| Showrooms   | GET    | /showrooms/suggestions         | Public. Lightweight suggestions (q required).                                           |
| Showrooms   | GET    | /showrooms/counters            | Public. Total count for current filters.                                                |
| Showrooms   | POST   | /showrooms/create             | OWNER/MANAGER. Creates showroom. `?mode=draft` to create draft.                         |
| Showrooms   | POST   | /showrooms/draft              | OWNER only. Create/reuse draft.                                                         |
| Showrooms   | GET    | /showrooms/{id}               | Public for approved; OWNER/ADMIN for own/any (incl pending/deleted).                    |
| Showrooms   | PATCH  | /showrooms/{id}               | OWNER only (own). Draft/rejected/approved; blocked while pending.                       |
| Showrooms   | DELETE | /showrooms/{id}               | OWNER only (own). Soft delete; blocked while pending.                                   |
| Showrooms   | POST   | /showrooms/{id}/submit        | OWNER only (own). Draft/rejected/approved → pending.                                    |
| Showrooms   | POST   | /showrooms/{id}/favorite      | Authenticated users. Idempotent favorite add; only approved showrooms.                 |
| Showrooms   | DELETE | /showrooms/{id}/favorite      | Authenticated users. Idempotent favorite remove.                                        |
| Admin       | GET    | /admin/showrooms              | ADMIN only. List all (incl pending/deleted).                                            |
| Admin       | GET    | /admin/showrooms/{id}         | ADMIN only. Get any showroom (incl deleted).                                            |
| Admin       | POST   | /admin/showrooms/{id}/approve | ADMIN only. Pending → approved.                                                         |
| Admin       | POST   | /admin/showrooms/{id}/reject  | ADMIN only. Pending → rejected (body: { reason }).                                      |
| Admin       | DELETE | /admin/showrooms/{id}         | ADMIN only. Soft delete any status.                                                     |
| Lookbooks   | GET    | /lookbooks                    | Public. Default `createdAt desc` with `cursor` and optional `showroomId`; legacy country+season mode supported. |
| Lookbooks   | GET    | /lookbooks/{id}               | Public. Published lookbook details with signed cover/images URLs.                       |
| Lookbooks   | POST   | /lookbooks                    | Public-compatible create. Auth or guest (`x-anonymous-id`).                             |
| Lookbooks   | POST   | /lookbooks/create             | Legacy alias for `POST /lookbooks`.                                                     |
| Lookbooks   | PATCH  | /lookbooks/{id}               | Public-compatible update. Owner only (auth/guest ownership).                            |
| Lookbooks   | DELETE | /lookbooks/{id}               | Public-compatible delete. Owner only (auth/guest ownership).                            |
| Lookbooks   | POST   | /lookbooks/{id}/favorite      | Authenticated users. Idempotent favorite add.                                           |
| Lookbooks   | DELETE | /lookbooks/{id}/favorite      | Authenticated users. Idempotent favorite remove.                                        |
| Lookbooks   | POST   | /lookbooks/{id}/rsvp          | Authenticated users. Stub.                                                              |
| Events      | GET    | /events                       | Public. Upcoming published events only (past excluded).                                 |
| Events      | GET    | /events/{id}                  | Public. Published event by id (direct link supports past events).                       |
| Events      | POST   | /events/{id}/want-to-visit    | Authenticated users. Idempotent.                                                        |
| Events      | DELETE | /events/{id}/want-to-visit    | Authenticated users. Idempotent.                                                        |
| Events      | POST   | /events/{id}/dismiss          | Authenticated users. Idempotent; hides event from authed list.                          |
| Events      | DELETE | /events/{id}/dismiss          | Authenticated users. Idempotent.                                                        |
| Events      | POST   | /events/{id}/rsvp             | Authenticated users. MVP2-only (`501 EVENTS_WRITE_MVP2_ONLY`).                          |
| Collections | GET    | /collections/favorites/showrooms | Public/any role. Guest gets empty; auth gets own favorite approved showrooms.      |
| Collections | POST   | /collections/favorites/showrooms/sync | Authenticated users. Sync guest-local showroom favorites.                        |
| Collections | GET    | /collections/favorites/lookbooks | Public route: guest gets empty, auth gets favorite lookbooks (published-only revalidation). |
| Collections | POST   | /collections/favorites/lookbooks/sync | Authenticated users. Sync guest-local lookbook favorites.                        |
| Collections | GET    | /collections/want-to-visit/events | Public route: guest gets empty, auth gets upcoming want-to-visit events.           |
| Collections | POST   | /collections/want-to-visit/events/sync | Authenticated users. Sync guest-local event state.                           |
| Dev         | POST   | /users/dev/register-test       | Dev/Test only. Creates mock user (not in OpenAPI).                                     |
| Dev         | POST   | /users/dev/make-owner          | Dev/Test only. Upgrades current user to owner (not in OpenAPI).                       |
