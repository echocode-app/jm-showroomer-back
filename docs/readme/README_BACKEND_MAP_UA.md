# README_BACKEND_MAP_UA

Детальна технічна мапа бекенду JM Showroomer.

Продакшен Swagger: https://jm-showroomer-back.onrender.com/docs/

## 1) Архітектура рівнями

Запит проходить так:
`routes -> middlewares -> controllers -> services -> Firestore`

- `routes` тримають API-контракт і middleware chain.
- `middlewares` відповідають за auth/role/validation/guard/error.
- `controllers` — thin HTTP layer.
- `services` — доменна логіка, транзакції, Firestore IO.
- `schemas` — Joi валідація вхідних payload.
- `utils` — загальні технічні утиліти.

## 2) Корінь `src/`

### `src/core/`
- `app.js`
  - створює Express app;
  - підключає CORS, JSON parser, request logging;
  - монтує `/docs` і `/api/v1`;
  - підключає глобальний error handler.
- `server.js`
  - старт процесу;
  - ініціалізація Firebase;
  - non-blocking index probe після `listen`.
- `error.js`
  - фабрики domain-помилок (`badRequest`, `notFound`, `forbidden`);
  - формує помилку з кодом + статусом.
- `errorCodes.js`
  - canonical мапа `code -> http status/message`.

### `src/config/`
- `index.js`
  - завантаження `.env.<NODE_ENV>`;
  - централізований runtime config.
- `firebase.js`
  - єдиний Firebase Admin init;
  - `getAuthInstance/getFirestoreInstance/getStorageInstance/getMessagingInstance`.
- `logger.js`
  - базовий логер wrapper.

### `src/constants/`
- `roles.js` — ролі та рольові константи.
- `countries.js` — нормалізація країн і блок-лист.
- `onboarding.js`, `mediaPolicy.js`, інші domain constants.

### `src/utils/`
- `apiResponse.js` — unified success/error response helpers.
- `pagination.js` — canonical limit parsing (strict/clamped).
- `timestamp.js` — canonical ISO/Timestamp normalization.
- `firestoreTransaction.js` — transaction wrapper helper.
- showroom/media/geo/actor helpers.

## 3) Middleware map (`src/middlewares/`)

- `auth.js`
  - strict auth guard;
  - вимагає Bearer token;
  - invalid token -> `AUTH_INVALID`.
- `optionalAuth.js`
  - best-effort auth для public endpoint-ів;
  - invalid token не валить запит.
- `loadUser.js`
  - mandatory user profile load;
  - deleted/missing -> `USER_NOT_FOUND`.
- `loadUserIfExists.js`
  - optional user load;
  - не блокує public flow.
- `role.js`
  - RBAC guard.
- `schemaValidate.js`
  - Joi body/params validation;
  - мапить required помилки на стабільні коди.
- `countryRestriction.js`
  - блокує заборонені країни (body/query/user/header).
- `rateLimit.js`
  - rate-limit policy;
  - input sanitize.
- `requestLogger.js`
  - логування методу/URL.
- `error.js`
  - глобальна нормалізація помилок у єдиний формат.

## 4) Routes map (`src/routes/`)

### `index.js`
Монтує роутери:
- `/health`
- `/users`
- `/auth`
- `/showrooms`
- `/lookbooks`
- `/events`
- `/collections`
- `/admin`

### `health.js`
- `GET /health/` — health check.

### `auth.js`
- `POST /auth/oauth` — Firebase token login.

### `user.js`
- profile, onboarding, owner profile completion;
- notifications read API;
- devices register/delete;
- dev-only test routes.

### `showrooms.js`
- list/get/suggestions/counters;
- create/draft/update/delete/submit;
- favorite/unfavorite.

### `lookbooks.js`
- create/list/get/update/delete;
- favorite/unfavorite;
- rsvp stub endpoint.

### `events.js`
- list/get;
- want-to-visit add/remove;
- dismiss/undismiss;
- rsvp stub endpoint.

### `collections.js`
- favorites collections list/sync;
- events want-to-visit collection list/sync.

### `admin.js`
- admin showroom moderation endpoints.

## 5) Controllers map (`src/controllers/`)

Контролери переважно thin:
- `authController.js` — oauth login orchestration.
- `showroomController.js` — showroom HTTP handlers.
- `lookbookController.js` — lookbook HTTP handlers.
- `eventController.js` — event HTTP handlers.
- `collectionController.js` — collections/sync handlers.
- `adminShowroomController.js` — admin moderation handlers.
- `users/*Controller.js`:
  - `profileController.js`;
  - `accountController.js`;
  - `notificationsController.js`;
  - `devicesController.js`.

## 6) Services map (`src/services/`)

## 6.1 Notifications

Папка `services/notifications/`:
- `create.js`
  - створення notification doc з dedupe id;
  - push dispatch only if doc newly created;
  - tx-mode: лише `tx.set`, без side effects.
- `read.js`
  - list/read/unread-count.
- `payload.js`
  - мапінг notification type -> push title/body.
- `utils.js`
  - cursor encode/decode;
  - limit clamp;
  - timestamp toISO.
- `dedupe.js`
  - helper для вже-існуючого dedupe doc.
- `types.js`
  - notification type enum + validation.

Compatibility wrappers:
- `notificationService.js`
- `readService.js`

## 6.2 Push

Папка `services/push/`:
- `send.js`
  - safe send orchestration;
  - no throw to business layer.
- `envGuard.js`
  - push feature gating (`PUSH_ENABLED`, `NODE_ENV`).
- `tokenResolver.js`
  - user/device opt-out filter + token list.
- `payloadBuilder.js`
  - FCM multicast payload normalization.

Compatibility wrapper:
- `pushService.js`.

## 6.3 Users devices

Папка `services/users/devices/`:
- `register.js`
  - upsert device документ;
  - transaction guard;
  - preserve device-level opt-out.
- `remove.js`
  - delete device registration.
- `validation.js`
  - normalize payload and validation.

Compatibility wrapper:
- `services/users/deviceService.js`.

## 6.4 Showrooms

Ключові файли:
- `createDraftShowroom.js` — draft create flow.
- `createShowroom.js` — create from payload.
- `updateShowroom.js` + `update/*` — patch/update flow.
- `submitShowroomForReview.js` + `submit/*` — submit pending flow.
- `approveShowroom.js` — admin approve + history + notification.
- `rejectShowroom.js` — admin reject + reason + notification.
- `deleteShowroom.js` — soft delete.
- `userShowroomState.js` — favorite state + sync + paging.
- `listShowrooms.js` + `list/*` — listing/search engine.
- `suggestShowrooms.js`, `countShowrooms.js`.

Папка `showrooms/list/`:
- `parse/*` — parsing/cursor/filter normalization.
- `firestore/*` — query builders per mode.
- `utils/*` — visibility/meta/cursor helper logic.
- `ordering.js`, `dev.js`, `devFilters.js`.

## 6.5 Lookbooks

Ключові файли:
- `crud.js` — main create/read/update/delete/favorite logic.
- `crudHelpers.js` — helper operations для likes/favorites.
- `parse.js`, `parseCursor.js` — list/sync parsing.
- `response.js` — response normalization + signed URLs logic.
- `firestoreQuery.js` — shared query + index error mapping.
- `syncGuestFavorites.js` — guest sync merge logic.
- `userLookbookState.js` — per-user collection state.
- `listLookbooks.js` + `list/*` — list layer.

## 6.6 Events

Ключові файли:
- `listEvents.js` — events listing flow.
- `getEventById.js` — detail flow.
- `userEventState.js` — want/dismiss state transitions.
- `syncGuestState.js` — guest sync merge.
- `eventResponse.js` — response projection helpers.
- `parse.js` — filters/limit/cursor parse.
- `firestoreQuery.js` — query helpers.

## 6.7 Інші service entrypoints

- `showroomService.js`, `lookbooksService.js`, `eventsService.js`
  - фасадні export-barrel файли.
- `authService.js`, `userService.js`, `mediaService.js`, `testUserService.js`.

## 7) Schemas map (`src/schemas/`)

- `showroom.*.schema.js`
- `lookbook.*.schema.js`
- `event.rsvp.schema.js`
- `user.profile.schema.js`
- `user.device.schema.js`
- `user.complete-owner-profile.schema.js`
- `showroom.review.schema.js`

Роль:
- body/params validation до входу в controller.

## 8) Data model (Firestore)

Основні колекції:
- `users/{uid}`
- `showrooms/{id}`
- `lookbooks/{id}`
- `events/{id}`

User subcollections:
- `users/{uid}/devices/{deviceId}`
- `users/{uid}/notifications/{dedupeKey}`
- `users/{uid}/showrooms_favorites/{showroomId}`
- `users/{uid}/lookbooks_favorites/{lookbookId}`
- `users/{uid}/events_want_to_visit/{eventId}`
- `users/{uid}/events_dismissed/{eventId}`

## 9) Ключові інваріанти

1. No external side effects inside Firestore tx callback.
2. Notification dedupe key = document id.
3. Push dispatch only after notification persisted and only for newly created dedupe doc.
4. Push failures never break business response.
5. User/device notification opt-out always respected in push resolver.
6. Favorite/want-to-visit flows idempotent.
7. Cursor contract backend-owned and validated.

## 10) Guest sync логіка

- Payload проходить strict validation.
- IDs дедупляться зі збереженням порядку.
- Обмеження max items enforced.
- Невалідні/недоступні ресурси віддаються у `skipped`.

## 11) Admin moderation логіка

- Доступ лише для admin.
- Approve/reject transitions робляться транзакційно.
- Історія змін та review поля оновлюються атомарно.
- Notification emission відбувається post-commit.

## 12) Test system map

Поточна структура:
- `src/test/core/` — core smoke entry.
- `src/test/flows/` — canonical domain flows.
- `src/test/integrations/` — detailed scenario scripts.
- `src/test/prod/` — prod-only checks.
- `src/test/lib/` — shared shell helpers.
- `src/test/lib/helpers/` — domain helper suites.
- `src/test/archive/` — legacy/retired scripts.

Root `src/test/test_*.sh` залишені як compatibility wrappers.

## 13) Документація

- Prod Swagger: https://jm-showroomer-back.onrender.com/docs/
- `docs/openapi.yaml` — root OpenAPI.
- `docs/*.yaml` — domain OpenAPI modules.
- `docs/readme/DEV.md` — dev workflow.
- `docs/readme/DEV_POSTMAN_TESTS.md` — manual API checks.
- `docs/readme/README_DETAIL.md` — Flutter-focused detail.
- `docs/readme/README_UA.md` — business-level UA summary.
- `docs/readme/SHOWROOMS_MVP1_SEARCH.md` — search integration detail.
