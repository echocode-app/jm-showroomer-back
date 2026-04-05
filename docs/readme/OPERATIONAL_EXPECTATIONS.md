# Operational Expectations (SLO, Limits, Reliability)

## 1) Reliability model

- Бізнес-операції мають залишатись працездатними навіть при деградації non-critical підсистем.
- Push та analytics - best-effort канали; їхня деградація не повинна ламати core API флоу.

## 2) Rate limiting

- Загальний API rate limiter застосовується до `/api/v1/*`.
- `/analytics/ingest` має окремий limiter bucket.
- При перевищенні ліміту повертається `429 RATE_LIMIT_EXCEEDED`.

## 3) Timeout/retry guidance для клієнтів

Рекомендації для мобільних клієнтів:
- connect timeout: 5s
- read timeout: 15s
- retries: максимум 2 повтори для `GET`/ідемпотентних mutate endpoint-ів
- exponential backoff: 500ms -> 1500ms
- для `POST /analytics/ingest` дозволений silent drop після retry budget

## 4) Cursor/pagination safety

- Cursor opaque і endpoint-specific.
- Після зміни фільтрів або режиму запиту курсор треба скидати.
- Помилка курсора: `400 CURSOR_INVALID`.

## 5) Known limitations (MVP)

- `POST /events/{id}/rsvp` повертає `501 EVENTS_WRITE_MVP2_ONLY`.
- `POST /lookbooks/{id}/rsvp` повертає `501 LOOKBOOKS_WRITE_MVP2_ONLY`.
- Nearby search базується на geohash-префіксах (approximate area filtering, не distance-sort).
- Map viewport flows (`GET /showrooms/map`, `GET /showrooms/map/counters`) також використовують geohash для candidate selection,
  але фінальний viewport filter застосовується точно по bounds; `map/counters` повертає exact count для переданого прямокутника.
- Частина advanced role flows (`manager`, `stylist`) зарезервовані для MVP2.

## 6) Error handling expectations

- Клієнт повинен обробляти `error.code` як первинний контракт.
- `message` вважається user-readable, але не є єдиним джерелом логіки гілкування.
- Для операційних інцидентів критичні коди: `INDEX_NOT_READY`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`.
