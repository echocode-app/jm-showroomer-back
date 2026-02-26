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

## Query Params

- `from` (optional, ISO datetime, inclusive)
  - default: `now - 30 days`
- `to` (optional, ISO datetime, exclusive)
  - default: `now`
- `groupBy` (optional)
  - `day` | `week` | `month`
  - default: `day`

Invalid `from` / `to` / `groupBy` returns `QUERY_INVALID` (400).

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
- Aggregations use Firestore `count()` where possible.
- Showroom moderation approve/reject metrics are counted from embedded `editHistory`, so backend uses a
  range-bounded Firestore read (`updatedAt >= from`) and filters history entries in memory (Firestore cannot aggregate nested history actions).
- Platform analytics totals use aggregate `count()`, while `timeline` and `byEventName` require a range-bounded read
  of `analytics_events` within the requested timestamp window.
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
