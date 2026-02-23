# Analytics Contract (Backend, MVP)

## 1. Canonical Envelope

All analytics events are stored in a canonical envelope with these top-level fields:

- `eventId`
- `eventName`
- `schemaVersion`
- `eventVersion`
- `timestamp`
- `user`
- `context`
- `resource`
- `meta`

`eventId` is always generated on the server.

## 2. Server-Generated Events

Current server-generated events (Stage 2A + 2B):

- `auth_completed`
- `auth_failed`
- `showroom_favorite`
- `showroom_unfavorite`
- `lookbook_favorite`
- `lookbook_unfavorite`
- `event_want_to_visit`
- `event_remove_want_to_visit`
- `showroom_create_started`
- `showroom_submit_for_review`
- `showroom_view`
- `lookbook_view`
- `event_view`

## 3. Client-Generated Events

Client-originated analytics events are accepted via:

- `POST /api/v1/analytics/ingest`

Backend validates input, builds the canonical envelope, and stores the event in Firestore `analytics_events`.

## 4. Anti-Storm Policy

Detail view events use backend-side throttle:

- max `1` emit per `10s` per `actor + resource`
- in-memory throttle (`Map`)
- per-instance only
- emit is non-blocking (`record(...).catch(...)`)

This is MVP-safe and can be upgraded to Redis in MVP2.

## 5. Invariants

- Analytics is never emitted inside Firestore transaction callbacks
- Analytics never blocks business flow
- `eventId` is always server-generated
- canonical `actorId` format:
  - `u:<uid>`
  - `a:<anonymousId>`

## Schema Freeze Policy (MVP1)

- `schemaVersion = 1`
- `eventVersion = 1`
- Breaking changes require version bump
- `eventName` must exist in `ANALYTICS_EVENTS` registry
- `eventName` must be `snake_case`
- All server events must use registry constant (no string literals)
