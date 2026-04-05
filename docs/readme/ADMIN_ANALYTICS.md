# Admin Analytics Endpoints

Admin analytics endpoints are read-only aggregations for internal dashboards.

## Access

- Admin only
- Middleware chain (via `/api/v1/admin` router):
  - `authMiddleware`
  - `loadUser`
  - `requireRole([admin])`

## Endpoints

- `GET /api/v1/admin/analytics/showrooms`
- `GET /api/v1/admin/analytics/events`
- `GET /api/v1/admin/analytics/platform`
- `GET /api/v1/admin/analytics/users-onboarding`

## Query Params

- `from` (optional, ISO datetime, inclusive)
  - default: `now - 30 days`
- `to` (optional, ISO datetime, exclusive)
  - default: `now`
- `groupBy` (optional)
  - `day` | `week` | `month`
  - default: `day`

Invalid `from` / `to` / `groupBy` returns `QUERY_INVALID` (400).

`/admin/analytics/users-onboarding` query params:

- `from` (optional, ISO datetime, inclusive, default `now - 30 days`)
- `to` (optional, ISO datetime, exclusive, default `now`)
- `includeUsers` (optional, boolean, default `false`)
- `limit` (optional, integer `1..200`, default `50`, used with `includeUsers=true`)
- `cursor` (optional, opaque cursor from previous response `meta.nextCursor`)

## Response Envelope

All endpoints use the standard success envelope:

```json
{
  "success": true,
  "data": { "...": "..." },
  "meta": {}
}
```

## Notes

- Read-only: no writes, no moderation changes, no analytics ingestion side effects.
- Query-critical lifecycle fields (`createdAt`, `updatedAt`, `submittedAt`, `reviewedAt`) are stored as Firestore-native timestamps.
- Legacy string-based documents should be normalized before relying on dashboard ranges (`npm run migrate:timestamps:dry` / `npm run migrate:timestamps`).
- Aggregations use Firestore `count()` where possible.
- Showroom moderation approve/reject metrics are counted from embedded `editHistory`, so backend uses a
  range-bounded Firestore read (`updatedAt >= from`) and filters history entries in memory (Firestore cannot aggregate nested history actions).
- Platform analytics totals use aggregate `count()`, while `timeline` and `byEventName` require a range-bounded read
  of `analytics_events` within the requested timestamp window.
- Users onboarding endpoint now includes:
  - `funnel` (users collection aggregate)
  - `journey` (analytics-events-based stage progression and drop-off)
- Timeline buckets are UTC-based.
- `week` buckets start on Monday (UTC).

## Example cURL

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://<host>/api/v1/admin/analytics/showrooms?from=2026-02-01T00:00:00.000Z&to=2026-03-01T00:00:00.000Z&groupBy=day"
```

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://<host>/api/v1/admin/analytics/events?groupBy=week"
```

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://<host>/api/v1/admin/analytics/platform?groupBy=month"
```

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://<host>/api/v1/admin/analytics/users-onboarding?from=2026-02-01T00:00:00.000Z&to=2026-03-01T00:00:00.000Z&includeUsers=true&limit=20"
```
