# QA Postman Tester Checklist (MVP1, Step-by-step)

## 1) Для кого документ

Цей документ для тестувальника, який тестує API через Postman, дивиться Render logs і не має доступу до Firebase Console.

## 2) Підготовка Postman

1. Створити Environment `JM Showroomer QA`.
2. Додати змінні:
- `baseUrl` = `https://<render-domain>/api/v1`
- `idToken_user`, `idToken_owner`, `idToken_admin`
- `auth_user` = `Bearer {{idToken_user}}`
- `auth_owner` = `Bearer {{idToken_owner}}`
- `auth_admin` = `Bearer {{idToken_admin}}`
- `showroom_id`, `lookbook_id`, `event_id`, `notification_id`, `cursor`

3. Створити колекцію `JM Backend QA MVP1` з папками:
- `00 Smoke`
- `01 Auth + Users`
- `02 Showrooms`
- `03 Lookbooks`
- `04 Events`
- `05 Collections Sync`
- `06 Notifications`
- `07 Analytics`
- `08 Negative + Security`

## 3) Go/No-Go smoke

1. `GET {{baseUrl}}/health` -> `200`.
2. `POST {{baseUrl}}/auth/oauth` з валідним `idToken` -> `200`.
3. `GET {{baseUrl}}/showrooms` -> `200`.
4. `GET {{baseUrl}}/lookbooks?country=Ukraine` -> `200`.
5. `GET {{baseUrl}}/events` -> `200`.

Якщо хоч один smoke падає, детальний regression не продовжувати.

## 4) Детальні сценарії

## 4.1 Auth + Users

1. `POST /auth/oauth` без idToken -> `400 ID_TOKEN_REQUIRED`.
2. `GET /users/me` без auth -> `401`.
3. `GET /users/me` з auth -> `200`.
4. `PATCH /users/profile` valid -> `200`; invalid -> `400 VALIDATION_ERROR`.
5. `POST /users/complete-onboarding` двічі -> стабільно, без 500.
6. `POST /users/complete-owner-profile` (user token) -> `200`, роль owner.

## 4.2 Showrooms

1. `POST /showrooms/draft` (owner) -> зберегти `showroom_id`.
2. `PATCH /showrooms/{{showroom_id}}` -> `200`.
3. `POST /showrooms/{{showroom_id}}/submit` -> `200`, pending.
4. `PATCH pending showroom` -> `409 SHOWROOM_LOCKED_PENDING`.
5. `POST /admin/showrooms/{{showroom_id}}/approve` (admin) -> `200`.
6. Pagination: `GET /showrooms?limit=2`, далі з `nextCursor`.
7. Invalid cursor: `GET /showrooms?cursor=invalid` -> `400 CURSOR_INVALID`.
8. Favorite idempotency: POST/POST/DELETE/DELETE -> `200`.

## 4.3 Lookbooks

1. `GET /lookbooks?country=Ukraine&limit=2` -> `200`, зберегти `lookbook_id`.
2. `GET /lookbooks/{{lookbook_id}}` -> `200`.
3. `GET /lookbooks?country=Ukraine&cursor=invalid` -> `400 CURSOR_INVALID`.
4. Nearby: `GET /lookbooks?country=Ukraine&nearLat=50&nearLng=30&nearRadiusKm=5` -> `200`.
5. Favorite idempotency: POST/POST/DELETE/DELETE -> `200`.
6. `GET /lookbooks/not-existing-id` -> `404 LOOKBOOK_NOT_FOUND`.

## 4.4 Events

1. `GET /events?limit=2` -> `200`, зберегти `event_id`.
2. `GET /events/{{event_id}}` -> `200`.
3. `want-to-visit` POST/POST/DELETE/DELETE -> `200`.
4. `dismiss` POST/POST/DELETE/DELETE -> `200`.
5. `POST /events/{{event_id}}/rsvp` -> `501 EVENTS_WRITE_MVP2_ONLY`.

## 4.5 Collections Sync

1. `POST /collections/favorites/showrooms/sync`
2. `POST /collections/favorites/lookbooks/sync`
3. `POST /collections/want-to-visit/events/sync`

Перевірити: `applied/skipped`, повторний sync без дублів.

## 4.6 Notifications

1. `GET /users/me/notifications` -> `200`.
2. `GET /users/me/notifications/unread-count` -> `200`.
3. `PATCH /users/me/notifications/{notificationId}/read` -> `200` (повтор теж `200`).
4. Неіснуючий id -> `404 NOTIFICATION_NOT_FOUND`.

## 4.7 Analytics

1. `POST /analytics/ingest` valid batch -> `200`.
2. Invalid eventName -> `400 EVENT_NAME_INVALID`.
3. При надмірній частоті можливий `429`.

## 5) Negative + Security

Для protected endpoint-ів перевірити:
1. без токена -> `401`.
2. неправильна роль -> `403 FORBIDDEN`.
3. битий payload -> `400`, не `500`.

## 6) Що дивитись у Render logs

Критичні сигнали:
- `status=500` на happy-path;
- масові `429`;
- `INDEX_NOT_READY` / `FAILED_PRECONDITION`;
- систематично повільні list endpoints.

## 7) Формат баг-репорту

1. Endpoint + метод.
2. Запит (headers/body/query).
3. Очікувано vs фактично.
4. `HTTP status` + `error.code`.
5. Час, середовище, скрін з Postman, фрагмент Render logs.
6. Severity: blocker/high/medium/low.
