# Admin Pending Queue Cursor (Flutter Integration)

> First read the universal guide: `docs/readme/CURSOR_PAGINATION_FLUTTER.md`  
> This document only explains admin pending queue specifics.

## Endpoint

`GET /admin/showrooms?status=pending`

This endpoint is an admin moderation queue with deterministic cursor pagination.

## Why cursor (and not page/offset)

The queue is sorted by backend data (`submittedAt desc` + document id tie-breaker).
When new items appear, offset-based pagination can produce duplicates or skipped items.

Cursor pagination prevents this:
- no duplicates between pages
- no skipped rows when timestamps are equal
- stable continuation from the last loaded item

## Flutter usage (required flow)

### 1) First request

Request without `cursor`:

`GET /admin/showrooms?status=pending&limit=20`

### 2) Read paging meta

Use response fields:
- `data.showrooms.meta.nextCursor`
- `data.showrooms.meta.hasMore`
- `data.showrooms.meta.paging`

### 3) Next page request

If `hasMore == true` and `nextCursor != null`, send the same request with the cursor:

`GET /admin/showrooms?status=pending&limit=20&cursor=<nextCursor>`

## Important rules (must follow)

- Treat `cursor` as **opaque**:
  - do not parse
  - do not edit
  - do not build it on the client
- Keep the same filters for continuation:
  - `status` must stay `pending`
  - `limit` may stay the same (recommended)
- If filters change, **reset cursor** and start from page 1

## Error handling

- Missing `status` on admin list -> `QUERY_INVALID`
- Invalid/foreign cursor -> `CURSOR_INVALID`

If Flutter receives `CURSOR_INVALID`:
1. clear local cursor
2. reload first page (`status=pending`, no cursor)

## Response expectations (queue item)

Queue list item is admin-specific and minimal. It includes:
- `id`
- `name`
- `type`
- `country`
- `city`
- `ownerUid`
- `submittedAt`
- `createdAt`
- `updatedAt`
- `editCount`
- `status`

It intentionally excludes internal moderation internals (`pendingSnapshot`, `editHistory`, derived fields).
