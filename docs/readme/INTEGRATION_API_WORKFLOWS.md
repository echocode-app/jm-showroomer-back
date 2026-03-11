# Integration API Workflows

Технічна карта endpoint-ів для інтеграції клієнтів і ручного QA.

## 1) Auth + User

- `POST /auth/oauth`
  - обмін Firebase ID token на backend profile envelope.
  - `400 ID_TOKEN_REQUIRED` якщо токен відсутній.
- `GET /users/me`
  - повертає поточний профіль.
  - без токена: `401`.
- `PATCH /users/profile`
  - часткове оновлення профілю.
  - невалідний payload: `400 VALIDATION_ERROR`.
- `POST /users/complete-onboarding`
  - фіксує завершення онбордингу (ідемпотентно).
- `POST /users/complete-owner-profile`
  - підвищення/заповнення owner-профілю.
- `DELETE /users/me`
  - soft-delete акаунта з guard-інваріантами на write-операції.

## 2) Devices + Notifications

- `POST /users/me/devices` - upsert device token.
- `DELETE /users/me/devices/{deviceId}` - відв'язка девайса.
- `GET /users/me/notifications` - список нотифікацій з пагінацією.
- `GET /users/me/notifications/unread-count` - unread counter.
- `PATCH /users/me/notifications/{notificationId}/read` - idempotent mark-as-read.

## 3) Showrooms

- `GET /showrooms` - список з підтримкою фільтрів, cursor, geo.
- `GET /showrooms/suggestions` - autocomplete suggestions.
- `GET /showrooms/counters` - швидкі лічильники по фільтрах.
- `GET /showrooms/{id}` - деталі showroom.
- `GET /showrooms/{id}/share` + `GET /share/showrooms/{id}` - share payload / redirect entry.
- `POST /showrooms/draft` - створення draft (owner).
- `POST /showrooms/create` - повне створення showroom.
- `PATCH /showrooms/{id}` - оновлення owner showroom.
- `POST /showrooms/{id}/submit` - відправка на модерацію.
- `DELETE /showrooms/{id}` - owner soft-delete.
- `POST|DELETE /showrooms/{id}/favorite` - ідемпотентний toggle стану.

### Стани showrooms

- `draft` -> `pending` -> `approved|rejected` -> `deleted`
- pending showroom lock: owner patch блокується (`409 SHOWROOM_LOCKED_PENDING`).

## 4) Admin

Потрібна роль `admin`.

- `GET /admin/overview`
- `GET /admin/analytics/showrooms`
- `GET /admin/analytics/events`
- `GET /admin/analytics/platform`
- `GET /admin/analytics/users-onboarding`
- `GET /admin/showrooms`
- `GET /admin/showrooms/{id}`
- `GET /admin/showrooms/{id}/history`
- `GET /admin/showrooms/{id}/stats`
- `POST /admin/showrooms/{id}/approve`
- `POST /admin/showrooms/{id}/reject`
- `DELETE /admin/showrooms/{id}`

## 5) Lookbooks

- `GET /lookbooks`
- `GET /lookbooks/{id}`
- `GET /lookbooks/{id}/share` + `GET /share/lookbooks/{id}` - share payload / redirect entry.
- `POST /lookbooks` (alias `POST /lookbooks/create`)
- `PATCH /lookbooks/{id}`
- `DELETE /lookbooks/{id}`
- `POST|DELETE /lookbooks/{id}/favorite`
- `POST /lookbooks/{id}/rsvp` (MVP-обмежений сценарій)

## 6) Events

- `GET /events`
- `GET /events/{id}`
- `GET /events/{id}/share` + `GET /share/events/{id}` - share payload / redirect entry.
- `POST|DELETE /events/{id}/want-to-visit`
- `POST|DELETE /events/{id}/dismiss`
- `POST /events/{id}/rsvp` (MVP2-only, очікувано `501` у MVP1)

## 7) Collections (guest -> auth sync)

- `GET /collections/favorites/showrooms`
- `POST /collections/favorites/showrooms/sync`
- `GET /collections/favorites/lookbooks`
- `POST /collections/favorites/lookbooks/sync`
- `GET /collections/want-to-visit/events`
- `POST /collections/want-to-visit/events/sync`

## 8) Analytics

- `POST /analytics/ingest`
  - приймає тільки whitelisted події.
  - не повинен блокувати бізнес-операції.
