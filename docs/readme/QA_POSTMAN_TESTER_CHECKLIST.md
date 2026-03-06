# QA Postman Tester Checklist (MVP1, Step-by-step)

## 1) Для кого документ

Цей документ для тестувальника, який тестує API через Postman, дивиться Render logs і не має доступу до Firebase Console.

## 2) Підготовка Postman

Рекомендований шлях:
1. Підключити локальний репозиторій у Postman (режим `Connect Local Repo`).
2. Взяти canonical файли:
   - `postman/collections/JM Showroomer - All Scenarios.postman_collection.json`
   - `postman/environments/JM_Showroomer_Environment__Template__Copy.postman_environment.json`
3. Заповнити в environment тільки:
   - `baseUrl`
   - `idToken_user`
   - `idToken_owner`
   - `idToken_admin`
4. `auth_user/auth_owner/auth_admin` руками не заповнювати (колекція проставляє автоматично).

Альтернативно можна зібрати колекцію вручну:

1. Створити Environment `JM Showroomer QA`.
2. Додати змінні:
- `baseUrl` = `https://<render-domain>/api/v1`
- `idToken_user`, `idToken_owner`, `idToken_admin`
- `auth_user`, `auth_owner`, `auth_admin` (можна лишити порожніми)
- `showroom_id`, `lookbook_id`, `event_id`, `notification_id`, `next_cursor`

3. Створити колекцію `JM Backend QA MVP1` з папками:
- `00 Smoke`
- `01 Auth + Users`
- `02 Showrooms`
- `03 Admin`
- `04 Lookbooks`
- `05 Events`
- `06 Collections Sync`
- `07 Analytics`
- `08 Negative + Security`

## 3) Go/No-Go smoke

1. `GET {{baseUrl}}/health` -> `200`.
2. `POST {{baseUrl}}/auth/oauth` з валідним `idToken` -> `200`.
3. `GET {{baseUrl}}/showrooms` -> `200`.
4. `GET {{baseUrl}}/lookbooks?limit=2` -> `200`.
5. `GET {{baseUrl}}/events` -> `200`.

Якщо хоч один smoke падає, детальний regression не продовжувати.

## 4) Детальні сценарії

## 4.1 Auth + Users

1. `POST /auth/oauth` без idToken -> `400 ID_TOKEN_REQUIRED`.
2. `GET /users/me` без auth -> `401`.
3. `GET /users/me` з auth -> `200`.
4. `PATCH /users/profile` до owner registration:
   - `appLanguage` / `notificationsEnabled` -> `200`
   - `name` / `country` / `position` / `instagram` -> `403 USER_PROFILE_FIELDS_FORBIDDEN`
5. `POST /users/complete-onboarding` двічі -> стабільно, без 500.
6. `POST /users/complete-owner-profile` (user token) -> `200`, роль owner.
7. `PATCH /users/profile` після owner registration:
   - `name` / `position` / `country` / `instagram` -> `200`
   - `country` при наявному owner контенті -> `409 USER_COUNTRY_CHANGE_BLOCKED`

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

1. `GET /lookbooks?limit=2` -> `200`, зберегти `lookbook_id`.
2. `GET /lookbooks/{{lookbook_id}}` -> `200`.
3. `GET /lookbooks?cursor=invalid` -> `400 CURSOR_INVALID`.
4. Nearby: `GET /lookbooks?nearLat=50&nearLng=30&nearRadiusKm=5` -> `200`.
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
4. Для id-залежних сценаріїв в regression колекції `404` може бути валідним контрактним результатом, якщо тестовий ресурс ще не створився у попередніх кроках.

## 6) Що дивитись у Render logs

Критичні сигнали:
- `status=500` на happy-path;
- масові `429`;
- `INDEX_NOT_READY` / `FAILED_PRECONDITION`;
- систематично повільні list endpoints.
