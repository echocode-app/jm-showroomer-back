# Showrooms Search Guide (MVP1)

Flutter integration with:
- `GET /showrooms`
- `GET /showrooms/suggestions`
- `GET /showrooms/counters`

Base API prefix:
- `/api/v1`

---

## 1) Endpoints by purpose

- `GET /showrooms`
  - Main list/map data endpoint.
  - Supports filters, search, map geohash filters, pagination cursor.

- `GET /showrooms/suggestions`
  - Lightweight suggestions for search input.
  - `q` is required.
  - `q.length < 2` returns empty list.

- `GET /showrooms/counters`
  - Total count for current filters.
  - Useful for UI label like "Found N showrooms".

---

## 2) MVP1 quick recipes (copy-paste)

```http
GET /showrooms?fields=card&limit=20
GET /showrooms?fields=card&limit=20&cursor=<meta.nextCursor>
GET /showrooms?fields=card&q=the&qMode=name&limit=20
GET /showrooms?fields=card&city=Kyiv&limit=20
GET /showrooms?fields=marker&geohashPrefix=u9yx8&limit=200
GET /showrooms?fields=marker&geohashPrefixes=u9yx8,u9yx9,u9yxb&limit=200
GET /showrooms/suggestions?q=to&qMode=name&limit=10
GET /showrooms/suggestions?q=ky&qMode=city&limit=10
GET /showrooms/counters?city=Kyiv&type=unique
GET /showrooms/counters?geohashPrefix=u9yx8&type=unique
```

---

## 3) Query parameter rules for `/showrooms`

Supported core params:
- `fields=card|marker`
- `limit=1..100`
- `cursor=<meta.nextCursor>`
- `q=<text>`
- `qMode=name|city`
- `city=<city>`
- `type=unique|multibrand`
- `category`, `categories`
- `categoryGroup`
- `subcategories`
- `geohashPrefix`
- `geohashPrefixes` (comma-separated)

Important combinations:
- `geohashPrefix` or `geohashPrefixes` + `q` is invalid -> `QUERY_INVALID`.
- `geohashPrefixes` with multiple values disables cursor paging:
  - `meta.paging=disabled`
  - `meta.nextCursor=null`
- Cursor is mode-specific:
  - if query mode changes (filters/search/order mode), old cursor becomes invalid.
- `fields=marker` and `fields=card` return different payload shapes.

MVP1 scope note:
- `brand` filter is API-ready but client UX can ignore it in MVP1.

---

## 4) Response contract you should rely on

Main envelope:
- `success: true`
- `data`
- `meta`

For `/showrooms`:
- `data.showrooms: []`
- `meta.hasMore: bool`
- `meta.nextCursor: string|null`
- `meta.paging: enabled|end|disabled`
- `meta.reason` may be present for disabled modes

Paging interpretation:
- `enabled` -> next page allowed with `cursor`.
- `end` -> no more pages.
- `disabled` -> do not paginate with cursor.

---

## 5) Flutter state model

Keep one immutable `SearchState` with:
- `mode: list|map`
- `fields: card|marker`
- `queryText: String`
- `searchIntent: auto|name|city`
- `filters: type/category/...`
- `geoPrefixes: List<String>`
- `items: List<Showroom>`
- `cursor: String?`
- `paging: enabled|end|disabled`
- `isLoadingFirstPage: bool`
- `isLoadingNextPage: bool`
- `errorCode: String?`

When any of these changes:
- `queryText`
- `searchIntent`
- any filter
- list/map mode
- `fields`
- geohash prefix set

Do:
- clear `items`
- set `cursor=null`
- set paging to initial
- request first page

---

## 6) Suggested search UX flow in Flutter

Input typing flow:
1. Debounce 300-400ms.
2. If text length < 2:
   - do not call suggestions, or accept empty response.
3. Call suggestions:
   - name mode: `/showrooms/suggestions?q=<text>&qMode=name&limit=10`
   - city mode: `/showrooms/suggestions?q=<text>&qMode=city&limit=10`
4. Merge suggestions in one list UI (single input, no mode switch):
   - city items first, then showroom items.
   - keep `type` in each suggestion item (`city` or `showroom`).
5. If user taps a suggestion:
   - `city` -> run list with `city=<value>`
   - `showroom` -> run list with `q=<value>&qMode=name`
6. If user presses Search without tapping suggestion:
   - run auto strategy:
     - step A: request city search `GET /showrooms?city=<text>&fields=card&limit=20`
     - if step A has results -> keep city mode
     - if step A has zero -> fallback to name search `GET /showrooms?q=<text>&qMode=name&fields=card&limit=20`
7. Keep active resolved intent until input text changes significantly.

---

## 7) Pagination and infinite scroll

First page:
- call `/showrooms?...&limit=20` without cursor.

Next page:
- only if `meta.paging=enabled` and `meta.nextCursor != null`.
- send exact same filters + `cursor=<meta.nextCursor>`.

Never do:
- generate cursor on client.
- reuse cursor after query/filter/mode changes.
- request next page when `paging=disabled` or `paging=end`.

---

## 8) Map mode rules

Single-prefix map query:
- use `geohashPrefix=<prefix>`
- cursor paging can work.

Multi-prefix map query:
- use `geohashPrefixes=p1,p2,p3`
- paging disabled by backend by design.
- render returned dataset as one viewport batch.

Name search in map mode:
- if geohash prefix(es) are present, do not send `q`.
- show user hint like:
  - "Name search is unavailable while map area filter is active."

---

## 9) Counters usage

Use counters for quick totals near filters/search:
- after filters are applied, call `/showrooms/counters` with same filter set.

Do not send to counters:
- `cursor`
- `fields`
- `limit`

Invalid combo:
- `geohashPrefix(es)` + `q` -> `QUERY_INVALID`.

---

## 10) Error handling checklist

Handle these API codes explicitly:
- `QUERY_INVALID`
  - invalid filter combinations or malformed params.
- `CURSOR_INVALID`
  - stale/wrong cursor for current mode.
- `INDEX_NOT_READY`
  - Firestore index missing for query pattern.

Client behavior:
- on `QUERY_INVALID`: reset conflicting params and retry with valid set.
- on `CURSOR_INVALID`: clear cursor and reload first page.
- on `INDEX_NOT_READY`: show fallback message and log query params for ops.

---

## 11) Minimal implementation checklist for Flutter dev

- Separate DTOs for `fields=card` and `fields=marker`.
- Centralized query builder to avoid invalid combinations.
- Single source of truth for filters/search/mode state.
- Debounced suggestions.
- Cursor lifecycle control (`null` on any mode/filter change).
- Guard next-page calls by `meta.paging`.
- Explicit error-code handling (`QUERY_INVALID`, `CURSOR_INVALID`, `INDEX_NOT_READY`).

---

## 12) Recommended backend ownership (for this UX)

Current API works, but for this single-input UX backend can reduce Flutter complexity.

Recommended incremental improvement:
- support `qMode=auto` on:
  - `GET /showrooms`
  - `GET /showrooms/suggestions`
- behavior:
  - try city interpretation first
  - fallback to name interpretation when city has no matches
  - return `meta.appliedSearchMode` (`city` or `name`) so client can debug/telemetry easily

Why:
- no selector in UI, so backend-assisted disambiguation is predictable
- less duplicated decision logic in Flutter
- keeps backward compatibility with existing `qMode=name|city`
