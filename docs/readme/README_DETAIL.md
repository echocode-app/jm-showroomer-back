# README_DETAIL (Flutter Integration, Full Current Iteration)

Prod Swagger: https://jm-showroomer-back.onrender.com/docs/

---

## 1) Базові принципи контракту

1. Backend є джерелом істини по станах (`status`, `likedByMe`, `isWantToVisit`, `isRead`, `meta.paging`, `nextCursor`).
2. Cursor завжди backend-owned, opaque, versioned.
3. Ключові mutate-flow endpoint-и реалізовані ідемпотентно.
4. Push не є критичним кроком бізнес-flow: якщо push не відправився, write-flow не має ламатися.

---

## 2) Auth та user identity

## `POST /auth/oauth`

Що робить:

- перевіряє Firebase ID token;
- піднімає Firestore user doc (якщо немає — створює базовий profile);
- повертає user payload, який далі використовується у Flutter bootstrap.

Що врахувати у Flutter:

- login завершеним вважається після успішного `/auth/oauth` + актуального `GET /users/me`.

## `GET /users/me`

Що робить:

- повертає актуальний profile з роллю, country, onboarding state та preference полями.

Що врахувати:

- не покладатись на локальний cached profile після зміни ролі/профілю — перечитувати `/users/me`.

## `PATCH /users/profile`

Що робить:

- partial update профілю.

Ключові правила:

- owner-only поля (`instagram`, `position`) доступні лише owner;
- country change для owner може бути заблокований якщо є активні showrooms/lookbooks/events;
- `notificationsEnabled` — user-level opt-out для push eligibility.

## `DELETE /users/me`

Що робить:

- запускає soft-delete поточного профілю;
- блокує видалення, якщо користувач володіє активними бізнес-сутностями (showrooms/lookbooks/events);
- операція ідемпотентна (`Account already deleted` при повторному виклику).

Ключові інваріанти:

- backend використовує delete-lock (`user.deleteLock`) на час delete flow;
- writability інваріант для мутацій: `!isDeleted && !deleteLock`;
- write-сервіси перевіряють інваріант у Firestore transaction (`assertUserWritableInTx`).

Сценарії відповіді:

- `200` — `Account deleted`
- `200` — `Account already deleted` (idempotent)
- `200` — `Account deletion in progress` (конкурентний повторний delete)
- `409 USER_DELETE_BLOCKED` — є ownership blockers

---

## 3) Devices та push prerequisites

## `POST /users/me/devices`

Що робить:

- upsert у `users/{uid}/devices/{deviceId}`;
- підтримка multi-device;
- оновлення `fcmToken/platform/appVersion/locale/lastSeenAt/updatedAt`.

Важливий інваріант:

- device-level `notificationsEnabled` не має випадково скидатись у `true` при update, якщо юзер раніше вимкнув device.

## `DELETE /users/me/devices/{deviceId}`

Що робить:

- видаляє конкретний device registration.

Що врахувати:

- викликати при logout, якщо треба припинити push саме для цього device.

---

## 4) Showrooms — бізнес-логіка

## 4.1 Стани showrooms

Реальний стан lifecycle:

- `draft`
- `pending`
- `approved`
- `rejected`
- `deleted`

Логічні наслідки:

- `approved` — публічно доступний у browse/list/favorites;
- `pending` — під модерацією, не повинен дрейфити від snapshot;
- `rejected` — може бути доопрацьований і повторно submit;
- `deleted` — soft delete, приховується у публічних flow.

## 4.2 Детальна логіка створення showroom

Є два шляхи створення:

### A) `POST /showrooms/draft`

- явно створює draft.
- використовується, коли UI хоче спочатку пустий/частково заповнений чернетковий об'єкт.

### B) `POST /showrooms/create`

- створює showroom через основний owner create flow;
- якщо передано query `mode=draft`, payload примусово маркується як draft-path.

Що реально відбувається в бекенді при create:

1. Перевірка auth + role (`owner`/дозволені ролі для create endpoint).
2. Country guard (blocked country блокує операцію).
3. Joi валідація payload.
4. Нормалізація ключових полів (name/address/geo-похідні поля, якщо релевантно).
5. Підготовка server-managed полів:
   - `createdAt`, `updatedAt`
   - статус
   - технічні поля для подальшого submit/moderation
6. Persist у Firestore.
7. Повернення normalized response DTO.

## 4.3 Update / Submit / Moderation

### `PATCH /showrooms/{id}`

- owner patch;
- back заповнює edit-history та updatedAt;
- валідація поля-до-поля.

### `POST /showrooms/{id}/submit`

- переводить у `pending`;
- фіксує `pendingSnapshot` (щоб модерація працювала з immutable зрізом);
- після submit showroom переходить у moderation-locked semantics.

### `POST /admin/showrooms/{id}/approve`

- перевірка статусу всередині tx;
- apply snapshot + status transition;
- атомарне оновлення history/review fields;
- `reviewReason` очищується (`null`) при approve;
- `editCount` інкрементиться;
- notification owner-у створюється post-commit.
- analytics event не емітиться (лише notification + domain log).

### `POST /admin/showrooms/{id}/reject`

- аналогічно атомарна tx перевірка;
- status -> rejected + reason (trim + min length validation на бекенді);
- `editCount` інкрементиться;
- `pendingSnapshot` очищується;
- notification owner-у post-commit.
- analytics event не емітиться (лише notification + domain log).

### `DELETE /showrooms/{id}`

- soft delete.

## 4.4 Favorites по showroom

`POST/DELETE /showrooms/{id}/favorite`

- idempotent add/remove;
- self-action не генерує owner notification;
- favorite-flow має anti-leak behavior для недоступних статусів.

## 4.5 Canonical vs Derived Fields (Showroom)

Canonical (source-of-truth):

- `name`, `address`, `country`
- `geo.city`, `geo.coords`
- `brands`

Derived (persisted for Firestore query/index performance):

- `nameNormalized` (name prefix search + duplicate guard)
- `addressNormalized` (duplicate detection only)
- `geo.cityNormalized` (city filter key)
- `geo.geohash` (map/geohash prefix mode)
- `brandsNormalized`, `brandsMap` (brand filtering/suggestions support)

Compatibility (kept for API stability):

- `city` (legacy mirror of `geo.city`)
- `location` (legacy mirror of `geo.coords`)

Important:

- client must not treat derived fields as writable source-of-truth;
- backend always recomputes derived values from canonical inputs;
- removing compatibility/derived fields requires staged deprecation + API version bump.

---

## 5) Гео-правила і geo-логіка

## 5.1 Geo model

Бекенд працює з гео-даними у структурі showroom (через `geo` поля та нормалізовані похідні значення).
Клієнт передає первинні geo поля, бекенд виконує нормалізацію/перевірки та використовує їх для search/filter.

## 5.2 Що валідуюється

На рівні логіки geo перевіряється:

- коректність координат (`lat/lng` в допустимих межах);
- валідність/непорожність міста в geo-контексті;
- консистентність країни (де потрібно — узгодженість з top-level `country`);
- нормалізовані похідні значення не приймаються як source-of-truth з клієнта, вони перераховуються сервером.

## 5.3 Що зберігається і як використовується

- `geo.cityNormalized` використовується для city query.
- `geo.geohash` використовується у map/geo prefix режимах.
- гео-поля впливають на suggestions/counters/list modes.

## 5.4 Search режими з geo

### City mode

- `qMode=city` або explicit `city`.
- explicit `city` має пріоритет.
- порівняння йде по normalized city.

### Geohash mode

- `geohashPrefix` або `geohashPrefixes`.
- multi-prefix може вимикати cursor paging (`paging=disabled`) через multi-branch злиття.

## 5.5 Geo та індекси

- частина geo-комбінацій потребує Firestore composite indexes;
- якщо index не готовий — повертається стабільна доменна помилка;
- Flutter має мати retry UX, а не трактувати як фатальний crash-case.

## 5.6 Практичні інтеграційні наслідки для Flutter

- при зміні geo-фільтра скидати cursor;
- не очікувати cursor у multi-prefix режимі;
- не генерувати geohash-related cursor локально;
- читати `meta.paging/nextCursor` як є.

---

## 6) Lookbooks — реалізована логіка

## `GET /lookbooks`

- list з actor-aware полями (`likedByMe`);
- роль/видимість впливають на результат.

## `POST /lookbooks` і `POST /lookbooks/create`

- create lookbook (`/create` — legacy alias).

## `GET /lookbooks/{id}`

- detail з visibility guard.

## `PATCH/DELETE /lookbooks/{id}`

- ownership/permission checks.

## `POST/DELETE /lookbooks/{id}/favorite`

- idempotent like/unlike;
- консистентність canonical likes + favorites collection.

## `POST /lookbooks/{id}/rsvp`

- endpoint з поточним контрактом (flow збережений).

---

## 7) Events — реалізована логіка

## `GET /events`

- public-compatible list;
- при auth збагачення user state.

## `GET /events/{id}`

- detail rules по published/visibility.

## `POST/DELETE /events/{id}/want-to-visit`

- idempotent state transitions.

## `POST/DELETE /events/{id}/dismiss`

- dismiss state transitions.

## `POST /events/{id}/rsvp`

- endpoint збережено по контракту.

---

## 8) Collections + guest sync

## Favorites collections

- `/collections/favorites/showrooms`
- `/collections/favorites/lookbooks`

## Want-to-visit collection

- `/collections/want-to-visit/events`

## Sync endpoints

- `/collections/favorites/showrooms/sync`
- `/collections/favorites/lookbooks/sync`
- `/collections/want-to-visit/events/sync`

Sync behavior:

- strict payload validation;
- max IDs enforcement;
- order-preserving dedupe;
- `skipped` для неприйнятих ids.
- applied/skipped ID arrays in API response are intentional (client merge reconciliation contract).
- sync domain logs store counts only (IDs are not emitted in logs).

---

## 9) Notifications та push

## Notifications triggers

- showroom approved
- showroom rejected
- showroom favorited
- lookbook favorited
- event want-to-visit

Storage:

- `users/{uid}/notifications/{dedupeKey}`;
- dedupe key = document id.

Read API:

- list/read/unread-count.

Push:

- запускається після create notification;
- йде тільки якщо notification newly created;
- поважає user/device opt-out;
- поважає env guard;
- fail-safe (не валить бізнес flow).

Notification policy (`MVP_MODE`):

- `MVP_MODE=false` (default): всі notification type-и дозволені.
- `MVP_MODE=true`: відключені `LOOKBOOK_FAVORITED` і `EVENT_WANT_TO_VISIT`.
- `SHOWROOM_APPROVED`, `SHOWROOM_REJECTED`, `SHOWROOM_FAVORITED` залишаються активними.
- policy впливає тільки на `notification storage + push dispatch` (доменної бізнес-операції не змінює).

---

## 10) Транзакційні інваріанти

1. side effects (push) поза Firestore tx callbacks;
2. moderation transitions перевіряються повторно всередині tx;
3. dedupe semantics захищає від повторних notification/push у retry-сценаріях;
4. idempotent mutate-flow не інфлейтить counters/state при повторі.

---

## 11) Error semantics

Критичні коди:

- `AUTH_MISSING`, `AUTH_INVALID`
- `QUERY_INVALID`, `VALIDATION_ERROR`
- `CURSOR_INVALID`
- `ACCESS_DENIED`, `FORBIDDEN`
- `COUNTRY_BLOCKED`
- `NOTIFICATION_NOT_FOUND`
- `INDEX_NOT_READY`

Практика:

- UX будувати по `error.code`;
- invalid cursor -> reset pagination state;
- index-not-ready -> retry pattern.

---

## 12) Реалізовані правила валідації

## 12.1 Загальна схема валідації

1. На рівні route використовується `schemaValidate(...)` з Joi-схемами (`src/schemas/*`).
2. Усі schema працюють з `allowUnknown: false`:
   - зайві поля від клієнта відхиляються;
   - системні поля (статуси, нормалізовані поля, ownerUid тощо) не приймаються з клієнта.
3. Для missing required полів у ключових payload діє мапінг кодів:
   - `name` -> `SHOWROOM_NAME_REQUIRED`
   - `type` -> `SHOWROOM_TYPE_REQUIRED`
   - `country` -> `COUNTRY_REQUIRED`
4. Інші Joi-помилки мапляться у `VALIDATION_ERROR`.

## 12.2 Валідація showroom create/update/submit

- `showroom.create.schema`:
  - два режими: draft і non-draft;
  - non-draft вимагає мінімум `name/type/country`;
  - `geo.coords.lat/lng` строго в межах (`-90..90`, `-180..180`);
  - server-managed поля заборонені (`status`, `ownerUid`, `nameNormalized`, `submittedAt` тощо).
- `showroom.update.schema`:
  - patch-only: мінімум одне поле (`.min(1)`);
  - заборона на технічні/модераційні поля (`pendingSnapshot`, `reviewedAt`, `deletedAt` тощо);
  - `geo` валідований аналогічно create.
- `showroom.submit.schema`:
  - body має бути порожнім обʼєктом;
  - `id` у params обовʼязковий.

## 12.3 Доменно-логічна валідація showroom

Додатково до Joi у сервісному шарі:

- `validateShowroomName(...)`:
  - довжина, набір символів, заборона чисто цифр/спаму/emoji;
  - помилка: `SHOWROOM_NAME_INVALID`.
- `validateInstagramUrl(...)`:
  - тільки `instagram.com` / `www.instagram.com`;
  - заборона query/hash;
  - помилка: `INSTAGRAM_INVALID`.
- `validatePhone(...)`:
  - E.164 + перевірка через `libphonenumber-js`;
  - помилка: `PHONE_INVALID`.
- `assertShowroomComplete(...)` перед submit:
  - вимагає обовʼязкові бізнес-поля;
  - помилка: `SHOWROOM_INCOMPLETE`.
- Перевірка доступу/власності/ролей:
  - `ACCESS_DENIED`, `FORBIDDEN`.

## 12.4 Гео-валідація

- `buildGeo(...)` і `normalizeCity(...)`:
  - сервер сам обчислює `geo.cityNormalized` і `geo.geohash`;
  - похідні geo-поля не є source-of-truth з клієнта;
  - гарантується консистентність для list/suggestions/counters.
- Geo/cursor/query некоректні комбінації:
  - повертають `QUERY_INVALID` або `CURSOR_INVALID`.

## 12.5 Валідація lookbooks/events/users/devices

- `lookbook.create/update`:
  - `imageUrl` та item `link` — тільки http/https URI;
  - `items` обмежено (max 30);
  - update вимагає мінімум 1 поле.
- `event.rsvp` / event state endpoints:
  - обовʼязковий `id` у params;
  - list-фільтри й cursor валідуються окремо.
- `user.profile`:
  - patch мінімум 1 поле;
  - типи і довжини полів обмежені;
  - `notificationsEnabled` строго boolean.
- `users/me/devices`:
  - `platform` тільки `ios|android`;
  - `fcmToken` і `deviceId` обовʼязкові;
  - params `deviceId` валідований окремо.

---

## 13) Перелік всіх error-кодів

Нижче зведений перелік кодів, які реально використовуються в поточній ітерації.

| Code                                  | HTTP | Де виникає / коли                                      |
| ------------------------------------- | ---- | ------------------------------------------------------ |
| `AUTH_MISSING`                        | 401  | немає auth header/token                                |
| `AUTH_INVALID`                        | 401  | невалідний/протермінований токен                       |
| `NO_AUTH`                             | 401  | auth-контекст відсутній там, де потрібен               |
| `ID_TOKEN_REQUIRED`                   | 400  | `/auth/oauth` без `idToken`                            |
| `FORBIDDEN`                           | 403  | роль/доступ заборонено                                 |
| `ACCESS_DENIED`                       | 403  | owner/admin доступ до ресурсу заборонено               |
| `COUNTRY_BLOCKED`                     | 403  | запит з заблокованої країни                            |
| `USER_NOT_FOUND`                      | 404  | профіль користувача не знайдено                        |
| `SHOWROOM_NOT_FOUND`                  | 404  | showroom не знайдено/непублічний у поточному контексті |
| `LOOKBOOK_NOT_FOUND`                  | 404  | lookbook не знайдено                                   |
| `EVENT_NOT_FOUND`                     | 404  | event не знайдено                                      |
| `NOTIFICATION_NOT_FOUND`              | 404  | notification не знайдено                               |
| `NOT_FOUND`                           | 404  | загальний not found                                    |
| `VALIDATION_ERROR`                    | 400  | Joi/domain валідація (загальний випадок)               |
| `SHOWROOM_NAME_REQUIRED`              | 400  | обовʼязкове `name` відсутнє                            |
| `SHOWROOM_TYPE_REQUIRED`              | 400  | обовʼязкове `type` відсутнє                            |
| `COUNTRY_REQUIRED`                    | 400  | обовʼязкове `country` відсутнє                         |
| `SHOWROOM_NAME_INVALID`               | 400  | невалідний showroom name                               |
| `SHOWROOM_CATEGORY_GROUP_INVALID`     | 400  | невалідний category group                              |
| `SHOWROOM_SUBCATEGORY_INVALID`        | 400  | невалідні subcategories                                |
| `SHOWROOM_SUBCATEGORY_GROUP_MISMATCH` | 400  | subcategories не відповідають group                    |
| `INSTAGRAM_INVALID`                   | 400  | невалідний Instagram URL                               |
| `PHONE_INVALID`                       | 400  | невалідний phone                                       |
| `SHOWROOM_INCOMPLETE`                 | 400  | submit/showroom не заповнений                          |
| `SHOWROOM_NOT_EDITABLE`               | 400  | showroom у стані без права edit                        |
| `SHOWROOM_NAME_ALREADY_EXISTS`        | 400  | name-конфлікт по бізнес-правилах                       |
| `SHOWROOM_DUPLICATE`                  | 400  | дубль showroom за нормалізованими ключами              |
| `NO_FIELDS_TO_UPDATE`                 | 400  | patch без полів для оновлення                          |
| `QUERY_INVALID`                       | 400  | невалідні query/filter params                          |
| `CURSOR_INVALID`                      | 400  | курсор невалідний/несумісний з режимом                 |
| `EVENT_SYNC_LIMIT_EXCEEDED`           | 400  | events sync payload перевищив ліміт                    |
| `LOOKBOOK_SYNC_LIMIT_EXCEEDED`        | 400  | lookbooks sync payload перевищив ліміт                 |
| `SHOWROOM_SYNC_LIMIT_EXCEEDED`        | 400  | showrooms sync payload перевищив ліміт                 |
| `LOOKBOOK_FORBIDDEN`                  | 403  | зміна чужого lookbook                                  |
| `SHOWROOM_ID_INVALID`                 | 400  | невалідний showroom id                                 |
| `ANON_ID_INVALID`                     | 400  | невалідний `x-anonymous-id`                            |
| `NOTIFICATION_TYPE_INVALID`           | 400  | невалідний тип notification                            |
| `INDEX_NOT_READY`                     | 503  | відсутній Firestore індекс для запиту                  |
| `SHOWROOM_LOCKED_PENDING`             | 409  | showroom locked у pending                              |
| `SHOWROOM_PENDING_SNAPSHOT_MISSING`   | 409  | немає snapshot для approve                             |
| `USER_COUNTRY_CHANGE_BLOCKED`         | 409  | зміну country заборонено через активні сутності        |
| `USER_DELETE_BLOCKED`                 | 409  | delete user заблоковано через owned business entities  |
| `RATE_LIMIT_EXCEEDED`                 | 429  | перевищено rate-limit middleware                       |
| `EVENTS_WRITE_MVP2_ONLY`              | 501  | write-endpoint події недоступний у MVP1                |
| `NOT_IMPLEMENTED`                     | 501  | не реалізовано                                         |
| `LOAD_USER_ERROR`                     | 500  | помилка `loadUser` middleware                          |
| `AUTH_ERROR`                          | 500  | внутрішня auth-помилка сервісу                         |
| `INTERNAL_ERROR`                      | 500  | fallback для непередбачених помилок                    |

Примітка по mapping:

- canonical status/message беруться з `src/core/errorCodes.js`;
- якщо код не описаний у `ERROR_STATUS`, використовується `err.status` або fallback `500`.

---

## 14) Ліміти в проекті

Нижче зведені фактичні ліміти, які зашиті в коді на поточній ітерації.

### 14.1 API pagination / list limits

| Домен / endpoint group                                      | Значення                 | Пояснення                                    |
| ----------------------------------------------------------- | ------------------------ | -------------------------------------------- |
| Showrooms list (`GET /showrooms`)                           | `default=20`, `max=100`  | Пагінація списку шоурумів                    |
| Showrooms suggestions (`GET /showrooms/suggestions`)        | `default=10`, `max=20`   | Окремий, більш строгий ліміт для suggestions |
| Showrooms counters sample internals                         | `MAX_SCAN=200`           | Внутрішня верхня межа скану/обробки          |
| Showrooms user favorites collection list                    | `default=20`, `max=100`  | Колекція обраних шоурумів користувача        |
| Lookbooks list (`GET /lookbooks`)                           | `default=20`, `max=100`  | Основний лістинг лукбуків                    |
| Lookbooks favorites collection list                         | `default=100`, `max=100` | Колекційний endpoint читає одразу до 100     |
| Events list (`GET /events`)                                 | `default=20`, `max=100`  | Основний лістинг подій                       |
| Events collection list (want-to-visit/dismissed read paths) | `default=100`, `max=100` | Колекційні read-потоки                       |
| Notifications list (`GET /users/me/notifications`)          | `default=20`, `max=100`  | Read/unread notifications pagination         |

### 14.2 Sync payload limits

| Flow                                                | Значення                    | Помилка/наслідок               |
| --------------------------------------------------- | --------------------------- | ------------------------------ |
| Showroom favorites sync                             | `SYNC_MAX_IDS=100`          | `SHOWROOM_SYNC_LIMIT_EXCEEDED` |
| Lookbook favorites sync                             | `SYNC_MAX_IDS=100`          | `LOOKBOOK_SYNC_LIMIT_EXCEEDED` |
| Event guest sync (`wantToVisitIds`, `dismissedIds`) | `MAX_SYNC_IDS_PER_LIST=100` | `EVENT_SYNC_LIMIT_EXCEEDED`    |

### 14.3 Geo / search / filter limits

| Ліміт                                  | Значення      | Де застосовується                                         |
| -------------------------------------- | ------------- | --------------------------------------------------------- |
| `MAX_GEO_PREFIXES`                     | `8`           | `geohashPrefix/geohashPrefixes` у showrooms list/counters |
| `SHOWROOM_SUGGEST_LIMIT`               | `10`          | Максимум showroom-name suggestions у змішаній видачі      |
| `SAMPLE_LIMIT`                         | `200`         | Семпл для city/brand suggestions                          |
| `categories` (`in`)                    | максимум `10` | Firestore `in`-фільтр                                     |
| `categoryGroup` (`in`)                 | максимум `10` | Firestore `in`-фільтр                                     |
| `subcategories` (`array-contains-any`) | максимум `10` | Firestore array filter                                    |
| `parseCategoryGroups`                  | максимум `10` | Валідаційна межа в parser                                 |
| `parseSubcategories`                   | максимум `10` | Валідаційна межа в parser                                 |

### 14.4 Internal batching / safety caps

| Ліміт                                                      | Значення      | Призначення                                         |
| ---------------------------------------------------------- | ------------- | --------------------------------------------------- |
| `IDS_CHUNK` (showrooms/lookbooks/events sync/read helpers) | `100`         | Chunked `db.getAll` для уникнення oversized RPC     |
| `LIKE_DELETE_BATCH_LIMIT`                                  | `500`         | Пакетне каскадне видалення likes у lookbook cleanup |
| `HISTORY_LIMIT` (showroom edit history)                    | `50`          | Soft-cap росту `editHistory` (зріз найстаріших)     |
| Media signed URL TTL                                       | `21600s` (6h) | Дефолтний строк дії signed read URL                 |

### 14.5 Middleware / platform guard limits

| Ліміт                             | Значення           | Коментар                               |
| --------------------------------- | ------------------ | -------------------------------------- |
| Rate limiter `dev`                | `2000 req / 5 min` | Для локальної/інтеграційної розробки   |
| Rate limiter `test`               | `2000 req / 5 min` | Для тестового середовища               |
| Rate limiter `prod`               | `300 req / 15 min` | Прод ліміт                             |
| Rate limiter fallback             | `100 req / 15 min` | Якщо env не мапиться                   |
| `x-anonymous-id` max length       | `128`              | Валідація actor identity               |
| Input sanitizer max depth         | `5`                | Захист від надмірної вкладеності       |
| Input sanitizer max string length | `10000`            | Обрізання надто довгих string payloads |

### 14.6 Як парситься `limit` (важливо для клієнта)

- У більшості list endpoint-ів використовується strict parser: нецілий/вихід за діапазон -> `QUERY_INVALID`.
- У notifications використовується clamped parser: дробові/завеликі значення притискаються до допустимого діапазону.
- Для стабільної інтеграції Flutter краще завжди передавати цілі значення в офіційних межах.

---

## 15) Трасувальна таблиця

Формат: `Route -> Controller -> Service -> Firestore`

| Route                                         | Controller                                                    | Service (основний)                                                                             | Firestore основні колекції                                                                        |
| --------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `POST /auth/oauth`                            | `authController.oauthLogin`                                   | `authService.verifyOAuthToken`                                                                 | `users/{uid}`                                                                                     |
| `GET /users/me`                               | `users/profileController.getMyProfile`                        | `middlewares/loadUser`                                                                         | `users/{uid}`                                                                                     |
| `PATCH /users/profile`                        | `users/profileController.updateUserProfile`                   | `users/profileService.updateUserProfileDoc`                                                    | `users/{uid}`                                                                                     |
| `POST /users/me/devices`                      | `users/devicesController.registerMyDevice`                    | `users/devices/register.registerUserDevice`                                                    | `users/{uid}/devices/{deviceId}`                                                                  |
| `DELETE /users/me/devices/{deviceId}`         | `users/devicesController.deleteMyDevice`                      | `users/devices/remove.removeUserDevice`                                                        | `users/{uid}/devices/{deviceId}`                                                                  |
| `GET /users/me/notifications`                 | `users/notificationsController.listMyNotifications`           | `notifications/read.listUserNotifications`                                                     | `users/{uid}/notifications/*`                                                                     |
| `PATCH /users/me/notifications/{id}/read`     | `users/notificationsController.markMyNotificationRead`        | `notifications/read.markNotificationRead`                                                      | `users/{uid}/notifications/{id}`                                                                  |
| `GET /users/me/notifications/unread-count`    | `users/notificationsController.getMyUnreadNotificationsCount` | `notifications/read.getUnreadNotificationsCount`                                               | `users/{uid}/notifications/*`                                                                     |
| `GET /showrooms`                              | `showroomController.listShowrooms`                            | `showrooms/listShowrooms.listShowroomsService`                                                 | `showrooms/*`                                                                                     |
| `GET /showrooms/{id}`                         | `showroomController.getShowroomById`                          | `showrooms/getShowroomById.getShowroomByIdService`                                             | `showrooms/{id}`                                                                                  |
| `POST /showrooms/create`                      | `showroomController.createShowroomController`                 | `showrooms/createShowroom.createShowroom`                                                      | `showrooms/*`                                                                                     |
| `POST /showrooms/draft`                       | `showroomController.createDraftShowroomController`            | `showrooms/createDraftShowroom.createDraftShowroom`                                            | `showrooms/*`                                                                                     |
| `PATCH /showrooms/{id}`                       | `showroomController.updateShowroom`                           | `showrooms/updateShowroom.updateShowroomService`                                               | `showrooms/{id}`                                                                                  |
| `POST /showrooms/{id}/submit`                 | `showroomController.submitShowroomForReviewController`        | `showrooms/submitShowroomForReview.submitShowroomForReviewService`                             | `showrooms/{id}`                                                                                  |
| `POST /admin/showrooms/{id}/approve`          | `adminShowroomController.approveShowroom`                     | `showrooms/approveShowroom.approveShowroomService` + `notifications/create.createNotification` | `showrooms/{id}`, `users/{ownerUid}/notifications/{dedupeKey}`                                    |
| `POST /admin/showrooms/{id}/reject`           | `adminShowroomController.rejectShowroom`                      | `showrooms/rejectShowroom.rejectShowroomService` + `notifications/create.createNotification`   | `showrooms/{id}`, `users/{ownerUid}/notifications/{dedupeKey}`                                    |
| `POST /showrooms/{id}/favorite`               | `showroomController.favoriteShowroom`                         | `showrooms/userShowroomState.favoriteShowroom`                                                 | `users/{uid}/showrooms_favorites/{id}`, `users/{ownerUid}/notifications/*`                        |
| `DELETE /showrooms/{id}/favorite`             | `showroomController.unfavoriteShowroom`                       | `showrooms/userShowroomState.unfavoriteShowroom`                                               | `users/{uid}/showrooms_favorites/{id}`                                                            |
| `GET /lookbooks`                              | `lookbookController.listLookbooks`                            | `lookbooks/crud.listLookbooksCrudService`                                                      | `lookbooks/*`, `lookbooks/{id}/likes/*`                                                           |
| `POST /lookbooks`                             | `lookbookController.createLookbook`                           | `lookbooks/crud.createLookbookService`                                                         | `lookbooks/*`                                                                                     |
| `POST /lookbooks/{id}/favorite`               | `lookbookController.favoriteLookbook`                         | `lookbooks/crud.likeLookbookService` + notifications                                           | `lookbooks/{id}/likes/*`, `users/{uid}/lookbooks_favorites/*`, `users/{ownerUid}/notifications/*` |
| `DELETE /lookbooks/{id}/favorite`             | `lookbookController.unfavoriteLookbook`                       | `lookbooks/crud.unlikeLookbookService`                                                         | `lookbooks/{id}/likes/*`, `users/{uid}/lookbooks_favorites/*`                                     |
| `GET /events`                                 | `eventController.listEvents`                                  | `events/listEvents.listEventsService`                                                          | `events/*`, user event state collections                                                          |
| `POST /events/{id}/want-to-visit`             | `eventController.markWantToVisit`                             | `events/userEventState.markEventWantToVisit` + notifications                                   | `users/{uid}/events_want_to_visit/*`, `users/{ownerUid}/notifications/*`                          |
| `DELETE /events/{id}/want-to-visit`           | `eventController.removeWantToVisit`                           | `events/userEventState.removeEventWantToVisit`                                                 | `users/{uid}/events_want_to_visit/*`                                                              |
| `POST /events/{id}/dismiss`                   | `eventController.dismissEvent`                                | `events/userEventState.dismissEvent`                                                           | `users/{uid}/events_dismissed/*`                                                                  |
| `POST /collections/favorites/showrooms/sync`  | `collectionController.syncGuestShowrooms`                     | `showrooms/userShowroomState.syncGuestShowroomFavorites`                                       | `users/{uid}/showrooms_favorites/*`                                                               |
| `POST /collections/favorites/lookbooks/sync`  | `collectionController.syncGuestLookbooks`                     | `lookbooks/syncGuestFavorites.syncGuestLookbookFavorites`                                      | `users/{uid}/lookbooks_favorites/*`, `lookbooks/{id}/likes/*`                                     |
| `POST /collections/want-to-visit/events/sync` | `collectionController.syncGuestEvents`                        | `events/syncGuestState.syncGuestEventsState`                                                   | `users/{uid}/events_want_to_visit/*`, `users/{uid}/events_dismissed/*`                            |

---

## 16) Таблиця всіх реалізованих роутів

| Method | Route                                           | Що робить (дуже коротко)   |
| ------ | ----------------------------------------------- | -------------------------- |
| GET    | `/health/`                                      | health check сервісу       |
| POST   | `/auth/oauth`                                   | логін по Firebase token    |
| GET    | `/users/me`                                     | поточний профіль           |
| DELETE | `/users/me`                                     | soft-delete профілю        |
| GET    | `/users/me/notifications`                       | список нотифікацій         |
| GET    | `/users/me/notifications/unread-count`          | кількість непрочитаних     |
| PATCH  | `/users/me/notifications/{notificationId}/read` | помітити як read           |
| POST   | `/users/me/devices`                             | upsert device для push     |
| DELETE | `/users/me/devices/{deviceId}`                  | видалити device            |
| POST   | `/users/complete-onboarding`                    | завершити onboarding       |
| POST   | `/users/complete-owner-profile`                 | завершити owner profile    |
| PATCH  | `/users/profile`                                | часткове оновлення профілю |
| POST   | `/users/dev/register-test`                      | DEV: створити test user    |
| POST   | `/users/dev/make-owner`                         | DEV: підняти role до owner |
| GET    | `/showrooms`                                    | list showroom              |
| GET    | `/showrooms/suggestions`                        | showroom suggestions       |
| GET    | `/showrooms/counters`                           | showroom counters          |
| GET    | `/showrooms/{id}`                               | showroom detail            |
| POST   | `/showrooms/create`                             | create showroom            |
| POST   | `/showrooms/draft`                              | create draft               |
| PATCH  | `/showrooms/{id}`                               | update showroom            |
| DELETE | `/showrooms/{id}`                               | soft delete showroom       |
| POST   | `/showrooms/{id}/submit`                        | submit на модерацію        |
| POST   | `/showrooms/{id}/favorite`                      | favorite showroom          |
| DELETE | `/showrooms/{id}/favorite`                      | unfavorite showroom        |
| GET    | `/lookbooks`                                    | list lookbooks             |
| POST   | `/lookbooks`                                    | create lookbook            |
| POST   | `/lookbooks/create`                             | legacy create alias        |
| GET    | `/lookbooks/{id}`                               | lookbook detail            |
| PATCH  | `/lookbooks/{id}`                               | update lookbook            |
| DELETE | `/lookbooks/{id}`                               | delete lookbook            |
| POST   | `/lookbooks/{id}/favorite`                      | favorite lookbook          |
| DELETE | `/lookbooks/{id}/favorite`                      | unfavorite lookbook        |
| POST   | `/lookbooks/{id}/rsvp`                          | lookbook rsvp flow         |
| GET    | `/events`                                       | list events                |
| GET    | `/events/{id}`                                  | event detail               |
| POST   | `/events/{id}/want-to-visit`                    | mark want-to-visit         |
| DELETE | `/events/{id}/want-to-visit`                    | remove want-to-visit       |
| POST   | `/events/{id}/dismiss`                          | dismiss event              |
| DELETE | `/events/{id}/dismiss`                          | undismiss event            |
| POST   | `/events/{id}/rsvp`                             | event rsvp flow            |
| GET    | `/collections/favorites/showrooms`              | list showroom favorites    |
| POST   | `/collections/favorites/showrooms/sync`         | sync showroom favorites    |
| GET    | `/collections/favorites/lookbooks`              | list lookbook favorites    |
| POST   | `/collections/favorites/lookbooks/sync`         | sync lookbook favorites    |
| GET    | `/collections/want-to-visit/events`             | list want-to-visit events  |
| POST   | `/collections/want-to-visit/events/sync`        | sync event guest state     |
| GET    | `/admin/showrooms`                              | admin list showrooms       |
| GET    | `/admin/showrooms/{id}`                         | admin showroom detail      |
| POST   | `/admin/showrooms/{id}/approve`                 | approve showroom           |
| POST   | `/admin/showrooms/{id}/reject`                  | reject showroom            |
| DELETE | `/admin/showrooms/{id}`                         | admin soft delete showroom |

---

## 17) Logging Architecture

### Domain log schema (canonical)

Backend uses a structured domain-log helper (`src/utils/logDomainEvent.js`) with canonical fields:

- `requestId` (auto from pino-http request context)
- `actorId` (auto if auth user or anonymous header is available)
- `domain` (required)
- `event` (required)
- `resourceType` / `resourceId` (optional)
- `status` (optional, but enforced if present)
- `meta` (optional, sanitized)

### Domains / events / statuses governance

- Domain-event taxonomy is centralized in `src/utils/domainEventCatalog.js`.
- Allowed statuses are centralized in `src/utils/domainStatusEnum.js`.
- In `NODE_ENV=dev` invalid schema/catalog/status throws immediately.
- In production invalid schema/catalog/status emits a safe fallback error log (`invalid_schema/*`) instead of crashing request flow.

### Error classification and log levels

- `src/utils/errorClassifier.js` maps errors into:
  - `domain_validation` -> `warn`
  - `business_blocked` -> `warn`
  - `infra` -> `error`
  - `unknown` -> `error`
- Controllers use this mapping for domain failure logs (e.g. auth/showroom failures).

### System-level logging behavior

- `rate limit` is logged in rate-limit middleware as `system.rate_limit` (`blocked`).
- `INDEX_NOT_READY` is logged centrally in error middleware as `system.index_not_ready` (`infra`).
- Error middleware respects `err.__domainLogged` to avoid duplicate domain logs.

### Meta governance / privacy

- `meta` removes PII keys (`email`, `phone`, `token`, `idToken`, `authorization`, `cookie`, `fcmToken`)
- Arrays are removed from `meta`
- Nested depth is capped
- Serialized `meta` size is capped (~1KB) with truncation fallback
- Sync logs store counts only (no ID arrays)

### Dev vs Prod differences (logging only)

- Dev: pino-pretty output is human-readable; domain logs include a cosmetic `msg` (e.g. `auth.login (failed)`).
- Prod: structured JSON remains the source of truth; domain helper emits payload-only structured fields.

### Favorite toggle debounce (logging-only)

- Rapid favorite/unfavorite toggles for the same `actor + entity` within `<300ms` suppress only domain log emission.
- Business logic and API responses are not affected.

---

## 18) Observability Guarantees

- Single domain log per state transition in covered flows (duplicate guard via `__domainLogged`)
- No domain logs emitted inside Firestore transaction callbacks (controllers/middleware emit post-service)
- No PII in domain-log `meta`
- Sync domain logs contain counts only
- Read flows (list/detail/suggestions/counters) do not emit domain logs
- Error severity mapping is semantic (`warn` for validation/blocked, `error` for infra)
- API responses, error codes, analytics, middleware order, and pino config are unchanged by logging layers

---

## 19) Flutter Integration Guarantees (Logging)

Logging changes are non-contractual and must not require Flutter-side changes.

- Response payload shapes are unchanged
- Error codes/messages remain backend-owned and unchanged
- No additional request headers are required for logging
- Cursor behavior and paging rules are unchanged
- Rate-limit response behavior is unchanged
- `INDEX_NOT_READY` remains a stable backend error (503 path) and should still be handled as retry-friendly UX
- Nearby search contract (`nearLat/nearLng/nearRadiusKm`) is unchanged by logging work

---

## 20) Analytics Ingest Hardening (Non-breaking)

`POST /analytics/ingest` keeps the same response contract, but backend now applies payload governance to client-supplied objects:

- sanitizer applies to `context`, `meta`, and `resource.attributes`
- PII-like keys are removed (for example `email`, `phone`, `token`, `authorization`, `cookie`, `fcmToken`)
- max nested depth = `2`
- arrays are allowed but capped to `20` items
- per-event client payload budget (`context + meta + resource.attributes`) is capped at ~`4KB`
- oversized client sections are truncated instead of rejecting the request

Additional ingest guarantees:

- `/analytics/ingest` uses a dedicated rate-limiter bucket (separate from business endpoints)
- ingest does **not** emit domain logs (request/system logs only)
- for `*_view`, `*_favorite`, `*_want_to_visit`, missing `resource.type/id` only emits a soft warning log (`analytics_invalid_shape`) and remains non-breaking
- moderation admin actions (`approve` / `reject`) are not analytics events in the current backend registry

---

## 21) Contract Freeze Hardening Notes

### Events timestamps

Public events responses normalize all event timestamps to ISO strings (or `null`):

- `startsAt`
- `endsAt`
- `createdAt`
- `updatedAt`

Firestore timestamp objects (`{ _seconds, _nanoseconds }`) are not part of the public API contract.

### Showrooms public DTO minimization

Public showroom payloads are whitelist-based and intentionally exclude internal fields:

- no `ownerUid`
- no `editHistory`
- no `pendingSnapshot`
- no moderation actor metadata (`reviewedBy`, `deletedBy`, etc.)
- no exact `geo.coords` in baseline public card/detail payloads
- no `contacts.phone` in public baseline payloads

Intentional exceptions:

- `GET /showrooms?fields=marker` returns minimal marker DTO with `geo.coords` for map rendering
- owner/admin showroom detail responses include privileged fields
