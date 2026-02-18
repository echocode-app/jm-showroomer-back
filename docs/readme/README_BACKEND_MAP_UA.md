# JM Showroomer Backend

> Аудиторія: backend розробник/технічний аудит. Це технічна карта проєкту.

---

## 1) Загальна архітектура

**Потік запиту:**
`routes → middlewares → controllers → services → Firestore`.

- **routes/** — оголошення HTTP endpoints і RBAC.
- **middlewares/** — auth, роль, валідація, country‑guard, rate limit, error.
- **controllers/** — thin‑layer: викликає сервіс і повертає ok/fail.
- **services/** — бізнес‑логіка + Firestore.
- **utils/** — нормалізація/валідація, формат відповіді.
- **docs/** — OpenAPI (модульні yaml).
- **src/test/** — bash‑тести контракту та флоу.

---

## 1.1) Карта впливів
- **Auth**: `src/routes/auth.js` → `src/controllers/authController.js` → `src/services/authService.js` → `src/config/firebase.js`
- **Onboarding**: `src/routes/user.js` → `src/controllers/userController.js` → `src/services/userService.js` + `src/constants/countries.js`
- **Owner profile**: `src/routes/user.js` → `src/controllers/userController.js` → `src/services/users/profileService.js` + `src/utils/showroomValidation.js`
- **User delete**: `DELETE /users/me` → `src/controllers/userController.js` → `src/services/users/profileService.js`
- **Showrooms CRUD**: `src/routes/showrooms.js` → `src/controllers/showroomController.js` → `src/services/showrooms/*.js`
- **Events (MVP1)**: `src/routes/events.js` → `src/controllers/eventController.js` → `src/services/eventsService.js` (`list/get/want-to-visit/dismiss` + guest sync service entry)
- **Showroom validation**: `src/schemas/showroom.*.schema.js` + `src/utils/showroomValidation.js` (barrel → normalization/rules)
- **Geo model**: `src/utils/geoValidation.js` → використовується у `createShowroom.js`, `updateShowroom.js`, `listShowrooms.js`
- **Moderation**: `src/routes/admin.js` → `src/controllers/adminShowroomController.js` → `src/services/showrooms/approveShowroom.js` / `rejectShowroom.js`
- **Search**: `src/services/showrooms/listShowrooms.js` (entry) + `src/services/showrooms/list/*` (parse/dev/firestore + shared `devFilters.js`)
- **Suggestions & Counters**: `src/services/showrooms/suggestShowrooms.js` (entry + `suggest/*` internals), `src/services/showrooms/countShowrooms.js`
- **Tests**: `src/test/test_smoke.sh`, `src/test/test_showrooms.sh`, `src/test/test_showrooms_favorites.sh`, `src/test/test_admin_and_collections.sh`, `src/test/test_media.sh`, `src/test/test_geo_paging_checks.sh`, `src/test/test_suggestions_and_counters.sh`

---

## 2) Файли — по каталогах

### Корінь репозиторію
- `package.json` — скрипти запуску (`dev`, `start`), залежності (Express, Firebase Admin, Joi, Swagger UI).
- `package-lock.json` — lockfile npm.
- `.env.*` — конфіги середовищ (dev/test/stage/prod).
- `firebase.json`, `.firebaserc` — Firebase config.
- `scripts/firebase_project_migration.sh` — стандартизований helper для міграції Firebase project (валідація env + deploy indexes + pre-prod checklist).
- `README.md` — основний технічний опис репозиторію.
- `README_DETAIL.md` — інструкція інтеграції для Flutter (англ.).
- `README_UA.md` — короткий опис бекенду українською.
- `README_BACKEND_MAP_UA.md` — цей файл.
- `docs/` — OpenAPI (modular). Деталі нижче.

### `src/core/`
- `app.js` — створює Express app: CORS, JSON, rateLimit+sanitize, логування, `/docs` (Swagger UI) і `/api/v1` router. Є `GET /` root. Підключає `errorHandler`.
- `server.js` — старт сервера + `initFirebase()`.
- `error.js` — фабрики помилок (`badRequest/forbidden/notFound`) з мапінгом через `errorCodes.js`.
- `errorCodes.js` — єдина таблиця кодів помилок → HTTP статус + дефолтне повідомлення.

### `src/config/`
- `index.js` — читає `.env.$NODE_ENV`, формує `CONFIG` (port, Firebase, origins).
- `firebase.js` — ініціалізація Firebase Admin (Auth/Firestore/Storage), дає getter‑и.
- `logger.js` — простий logger wrapper.

### `src/constants/`
- `roles.js` — ролі (guest/user/owner/admin + future: manager/stylist).
- `countries.js` — normalize + блок RU/BY (russia/belarus). Використовується в onboarding і showroom.
- `onboarding.js` — стани onboarding (new/completed).
- `mediaPolicy.js` — media policy (формати/ліміти, MVP1).

### `src/utils/`
- `apiResponse.js` — стандарт відповіді: `ok` / `fail` (код+message) / `created`.
- `showroomValidation.js` — barrel для нормалізації/валідацій:
  - name: мін. правила + нормалізація → `nameNormalized`
  - instagram url: тільки instagram.com
  - phone: **E.164‑only**, починається з `+`
  - address: normalize + `addressNormalized`
  - `assertShowroomComplete` — перевірка required полів при submit
- `showroomNormalization.js` — normalize helpers (name/brand/address/phone/instagram)
- `showroomValidationRules.js` — validate helpers (name/instagram/phone/submit completeness)
- `showroomValidation.test.js` — прості node‑тести для валідацій.
- `mediaValidation.js` — валідація media paths + нормалізація legacy → assets.
- `geoValidation.js` — нормалізація міста (`cityNormalized`) + geohash (precision 9).

---

## Geo model (MVP1)

**Суть:** Geo дані приходять від клієнта. Бекенд **не** викликає Google Maps і не робить геокодування.

**Структура в шоурумі:**
```json
{
  "geo": {
    "city": "Kyiv",
    "cityNormalized": "kyiv",
    "country": "Ukraine",
    "coords": { "lat": 50.4501, "lng": 30.5234 },
    "geohash": "u9yx8f7f3",
    "placeId": "ChIJBUVa4U7P1EAR_kYBF9IxSXY"
  }
}
```

**Пошук за містом:** `GET /showrooms?city=Kyiv` (фільтр по `geo.cityNormalized`).

**Country формат:** повна назва країни (наприклад `Ukraine`), **не** ISO2.

**Location vs Geo:**
- `location` — legacy поля для координат адреси.
- `geo.coords` — актуальні координати для пошуку/фільтрації.

**Валідація geo:**
- `geo.city` і `geo.country` мають бути непорожніми рядками.
- `geo.coords.lat/lng` — валідні координати.
- `geo.placeId` опційний; якщо є — непорожній рядок.
- `geo.country` має збігатися з top‑level `country` (case‑insensitive), інакше 400.
- `cityNormalized`/`geohash` клієнт не надсилає — бекенд ігнорує і рахує сам.

**PATCH:** `geo` не видаляється, тільки оновлюється повним об’єктом.

**Примітка:** при комбінованих фільтрах у Firestore може знадобитись composite index
(наприклад `status + geo.cityNormalized` або `ownerUid + geo.cityNormalized`).

---

## 2.1) Пошук / Фільтрація / Пагінація (Deep Dive)

### A) Showrooms: як працює list engine

**Endpoint:** `GET /showrooms`

**Основні query params:**
- `limit` — `1..100`, default `20`
- `cursor` — backend-owned base64 cursor
- `fields` — `marker | card`
- `q` — пошук (prefix по name або city, залежить від mode)
- `qMode` — `name | city`
- `city` — exact city filter (нормалізується)
- `brand` — exact filter по `brandsMap.<brandKey>`
- `type` — `unique | multibrand`
- `category`, `categories`
- `categoryGroup`
- `subcategories`
- `geohashPrefix` або `geohashPrefixes`

**Ключова логіка (важливо для Flutter):**
- Якщо `qMode=city`, тоді `q` інтерпретується як city (нормалізація на бекенді).
- Якщо передано `city`, він має пріоритет над `q` як city-filter.
- `geohashPrefix(es) + q(name)` одночасно не підтримується (`QUERY_INVALID`).
- Для `geohashPrefixes` з кількома префіксами пагінація cursor-ом вимикається:
  - `meta.paging = "disabled"`
  - `meta.nextCursor = null`
  - `meta.hasMore = false`
- Для одного geohash prefix cursor працює.

**Ordering режими (визначають cursor):**
- Map mode (`geohashPrefix*`): `geo.geohash asc`, tie-breaker `documentId asc`.
- Name mode (`q` по імені): `nameNormalized asc`, tie-breaker `documentId asc`.
- Default mode: `updatedAt desc`, tie-breaker `documentId asc`.

**Поведінка за ролями:**
- Guest/User: бачать тільки `status=approved`.
- Owner: бачить свої (можна фільтрувати по status).
- Admin: бачить всі (можна фільтрувати по status).
- `deleted` приховується post-filter-ом у більшості публічних owner/guest сценаріїв.

**meta контракт:**
- `paging: "enabled"` — є наступна сторінка.
- `paging: "end"` — кінець.
- `paging: "disabled"` — cursor не підтримується в цьому режимі.

---

### B) Events: фільтрація і cursor

**Endpoint:** `GET /events`

**Query params:**
- `country` (optional)
- `city` (optional, нормалізується в `cityNormalized`)
- `limit` (`1..100`, default `20`)
- `cursor` (v1)

**Базові фільтри бекенду:**
- тільки `published=true`
- тільки upcoming (`startsAt >= now`) у list
- blocked countries приховуються

**Auth-aware поведінка:**
- Без auth: повертає публічний список.
- З auth:
  - додає `isWantToVisit`
  - виключає dismissed events із list

**Cursor формат (v1):**
- base64 JSON: `{ v: 1, startsAt: string, id: string }`
- клієнт не має генерувати cursor вручну.

**Detail:** `GET /events/{id}`
- тільки published event
- past event дозволений за direct link

---

### C) Lookbooks (MVP1): фільтри, порядок, cursor

**Endpoints:**
- `GET /lookbooks` (list)
- `GET /lookbooks/{id}` (detail)

**List обовʼязкові query params:**
- `country` — required
- `seasonKey` — required
- `limit` — `1..100`, default `20`
- `cursor` — optional

Без `country` або `seasonKey` -> `400 QUERY_INVALID`.

**Фільтри list:**
- `published = true`
- `countryNormalized == normalize(country)`
- `seasonKey == lower(seasonKey)`

**Ordering/пагінація (single deterministic mode):**
- пріоритетно ранжовані (`sortRank` not null): `sortRank asc`
- далі unranked: `publishedAt desc`
- tie-breaker: `documentId`
- `meta`: `hasMore`, `nextCursor`, `paging: enabled|end`

**Media policy:**
- list: підписується тільки `coverUrl`
- detail: підписується `coverUrl` + всі `images[].url`
- unsafe storage paths не підписуються (URL буде `null`)

**Published visibility:**
- list повертає published (public default)
- detail повертає published для публічного доступу, а також власний unpublished для owner (auth або guest actor)
- якщо доступу немає -> `404 LOOKBOOK_NOT_FOUND`

---

### D) Collections: favorites/sync контракти

#### Events collections
- `GET /collections/want-to-visit/events` (public-compatible: guest empty, auth list)
- `POST /collections/want-to-visit/events/sync` (auth)
- sync payload: `{ wantToVisitIds: [], dismissedIds: [] }`
- max `100` ids per list
- duplicate id між списками: `wantToVisit` має пріоритет
- `skipped[]` для invalid/unpublished/past/blocked

#### Lookbooks favorites
- `POST /lookbooks/{id}/favorite` (auth-only, idempotent)
- `DELETE /lookbooks/{id}/favorite` (auth-only, idempotent)
- `GET /collections/favorites/lookbooks` (public-compatible: guest empty, auth list)
- `POST /collections/favorites/lookbooks/sync` (auth)
- sync payload: `{ favoriteIds: [] }`
- max `100` ids
- overflow code: `LOOKBOOK_SYNC_LIMIT_EXCEEDED`
- `skipped[]` для invalid/unpublished ids
- canonical likes: `lookbooks/{id}/likes/{actorKey}` + atomic `likesCount`
- mirror/projection: `users/{uid}/lookbooks_favorites/{lookbookId}`
- guest flow для lookbooks favorites: локальний стан у Flutter + `POST /collections/favorites/lookbooks/sync` після логіну

**Read-time revalidation (важливо):**
- collections list може містити історично застарілі ids у subcollection
- перед відповіддю бекенд перевіряє існування + published
- невалідні/hidden елементи не потрапляють у `items`

---

### E) State Transition Contract

**Мета:** всі mutating write-path операції мають детермінований результат переходу стану.

- Showroom favorite (`userShowroomState.favoriteShowroom`) повертає `{ applied: true|false }`:
  - `true` — favorite створений вперше.
  - `false` — favorite вже існував (idempotent no-op).
- Showroom unfavorite (`userShowroomState.unfavoriteShowroom`) повертає `{ removed: true|false }`:
  - `true` — favorite видалений.
  - `false` — favorite не існував.
- Events want-to-visit (`userEventState.markEventWantToVisit`) повертає `{ applied: true|false }` за таким самим правилом.
- Events remove want-to-visit (`userEventState.removeEventWantToVisit`) повертає `{ removed: true|false }`.
- Showroom moderation:
  - `approveShowroomService` повертає `{ statusChanged: true }`.
  - `rejectShowroomService` повертає `{ statusChanged: true }`.
  - Обидва переходи виконуються атомарно в Firestore transaction з повторною перевіркою статусу всередині транзакції.

**API compatibility:** контролери зберігають поточний HTTP контракт (`status: favorited/removed`, `showroom` payload для approve/reject).

---

### F) Помилки, які Flutter має обробляти обовʼязково

- `QUERY_INVALID` — некоректні query/body параметри
- `CURSOR_INVALID` — cursor пошкоджений або не відповідає mode
- `INDEX_NOT_READY` — Firestore index ще не готовий
- `LOOKBOOK_NOT_FOUND` — lookbook відсутній або unpublished
- `LOOKBOOK_SYNC_LIMIT_EXCEEDED` — перевищено ліміт `favoriteIds` у lookbooks sync
- `EVENT_NOT_FOUND` — event відсутній/недоступний
- `AUTH_MISSING` / `AUTH_INVALID` — токен відсутній/невалідний
- `COUNTRY_BLOCKED` — RU/BY policy

---

### G) Короткий FAQ для Flutter (готові відповіді)

**Q: Як правильно пагінувати список?**  
A: Брати `meta.nextCursor` і передавати як `cursor` у наступний запит. Не генерувати cursor на клієнті.

**Q: Що робити з `paging=disabled`?**  
A: Це режим, де cursor недоступний (наприклад multi-geohash у showrooms). Потрібно змінити режим запиту, а не намагатися пагінувати.

**Q: Чому 400 на `/lookbooks`?**  
A: Зазвичай відсутній/помилковий обовʼязковий фільтр `country` або `seasonKey`, або невалідний cursor/limit.

**Q: Чому в collections може бути менше елементів, ніж раніше лайкали?**  
A: Бекенд робить revalidation і відфільтровує hidden/deleted/unpublished.

**Q: Що означає `INDEX_NOT_READY`?**  
A: Для такого фільтра не готовий композитний індекс Firestore; треба задеплоїти/дочекатися індексу.

### `src/schemas/` (Joi)
- `showroom.create.schema.js` — create schema + режим `draft=true`.
- `showroom.update.schema.js` — patch schema (all optional, min 1 field).
- `showroom.submit.schema.js` — submit schema (params id, body empty).

### `src/middlewares/`
- `auth.js` — перевірка Firebase Bearer token → `req.auth`.
- `loadUser.js` — бере користувача з Firestore → `req.user`.
- `optionalAuth.js` — якщо є token, додає `req.auth`, інакше пропускає.
- `loadUserIfExists.js` — якщо є `req.auth`, дістає user, інакше мовчки.
- `role.js` — RBAC (403 FORBIDDEN).
- `schemaValidate.js` — Joi validation + мапінг required полів → SHOWROOM_*_REQUIRED.
- `validate.js` — legacy simple validation (не в ключових флоу).
- `countryRestriction.js` — блокує RU/BY на підставі body/query/user (403).
- `countryGuard.js` — блокує RU/BY по `req.user.country` (403).
- `rateLimit.js` — rate limiter + sanitize input.
- `requestLogger.js` — логування запитів.
- `error.js` — глобальний error handler (єдиний формат error).

### `src/routes/`
- `index.js` — монтує всі роутери під `/api/v1`.
- `health.js` — `GET /health`.
- `auth.js` — `POST /auth/oauth`.
- `user.js` — `/users/*` (me, delete, onboarding, owner-profile, profile update). Є dev-only: `/users/dev/*` (не в OpenAPI).
- `showrooms.js` — всі showroom endpoints, draft flow, submit.
- `admin.js` — admin moderation endpoints (`/admin/showrooms/*`).
- `lookbooks.js` — `GET /lookbooks`, `GET /lookbooks/{id}`, `POST/DELETE /lookbooks/{id}/favorite` (auth-only, idempotent), `POST/PATCH/DELETE /lookbooks/{id}` (public-compatible ownership), `POST /lookbooks/create` (legacy alias), `POST /lookbooks/{id}/rsvp` (stub).
- `events.js` — `GET /events`, `GET /events/{id}`, `POST/DELETE /events/{id}/want-to-visit`, `POST/DELETE /events/{id}/dismiss`, `POST /events/{id}/rsvp` (MVP2-only, 501).
- `collections.js` — `GET /collections/favorites/showrooms` (public, guest-empty + auth-real favorites list), `POST /collections/favorites/showrooms/sync` (auth, guest->user merge), `GET /collections/favorites/lookbooks` (public-compatible guest-empty + auth-real) + `POST /collections/favorites/lookbooks/sync` (auth), `GET /collections/want-to-visit/events` (public-compatible guest-empty + auth-real) + `POST /collections/want-to-visit/events/sync` (auth).

### Guest Event Likes Flow (MVP1)
- Guest не пише напряму у Firestore; стани like/dismiss зберігаються локально у клієнта.
- Після авторизації клієнт викликає `POST /collections/want-to-visit/events/sync`.
- Синк idempotent: `wantToVisit` і `dismissed` merge-яться з пріоритетом `wantToVisit`.
- Неіснуючі/unpublished/past/blocked-country events повертаються у `skipped`.

### `src/controllers/`
- `authController.js` — login через Firebase idToken.
- `userController.js` — me, complete‑onboarding, complete‑owner‑profile, profile update.
- `showroomController.js` — create/draft/list/get/update/submit/delete (thin‑layer).
- `adminShowroomController.js` — admin list/get/approve/reject/delete (moderation).
- `lookbookController.js` — list/detail/favorite/CRUD flows для MVP1 (`GET /lookbooks`, `GET /lookbooks/{id}`, auth-only `POST/DELETE /lookbooks/{id}/favorite`, `POST/PATCH/DELETE /lookbooks/{id}`) + legacy `create` alias і `rsvp` stub.
- `eventController.js` — list/get/want-to-visit/dismiss + MVP2-only RSVP guard.
- `collectionController.js` — real showroom favorites list (guest-empty/auth-real), real lookbook favorites list/sync, real events collections endpoints (`want-to-visit list` і `guest sync`).

### `src/services/`
- `authService.js` — **флоу створення user**: `verifyOAuthToken()` → Firebase verify → якщо user не існує в Firestore, створюється `users/{uid}` з роллю `user`, `onboardingState: new`.
- `userService.js` — логіка ролей користувача (roleRequest review).
- `users/profileService.js` — профіль користувача: onboarding/owner profile/update/delete + перевірка наявних showrooms/assets (showrooms/lookbooks/events).
- `showroomService.js` — фасад‑реекспорт з `src/services/showrooms/`.
- `mediaService.js` — signed READ URLs (MVP1).
- `services/lookbooks/*` — повний MVP1 набір:
  - `listLookbooks.js` — list за обовʼязковими `country/seasonKey`, cursor pagination, deterministic ranked/published ordering
  - `getLookbookById.js` — detail (published-only)
  - `userLookbookState.js` — favorite add/remove/list у `users/{uid}/lookbooks_favorites`
  - `syncGuestFavorites.js` — guest sync `{favoriteIds[]}` з `skipped[]`, idempotent
  - `response.js`/`parse.js`/`firestoreQuery.js` — нормалізація, path safety + signed URLs, query/cursor/index mapping

#### `src/services/showrooms/`
- `_store.js` — dev in‑memory store (NODE_ENV=dev).
- `_constants.js` — `EDITABLE_FIELDS` для PATCH.
- `_helpers.js` — helpers: `isSameCountry`, `buildDiff`, `makeHistoryEntry`, `appendHistory`, `buildPendingSnapshot`.
- `createDraftShowroom.js` — створення або повторне повернення draft.
- `createShowroom.js` — повне створення showroom (required checks + normalization).
- `create/` — create payload normalization + access validation helpers.
- `listShowrooms.js` — список з фільтрами (entry).
- `list/` — модулі списку:
  - `parse/` — парсинг/валідація query (q/city/brand/geo/cursor).
  - `utils/` — helpers для cursor/sort/visibility/payload.
  - `devFilters.js` — спільна dev-фільтрація для list/suggestions/counters.
  - `ordering.js` — правила сортування.
  - `dev.js` — dev‑mock реалізація.
  - `firestore.js` — Firestore реалізація (entry) + `firestore/` modes.
- `suggestShowrooms.js` — suggestions endpoint (lightweight hints, orchestration layer).
- `suggest/` — модулі suggestions: `dev.js`, `firestore.js`, `builders.js`, `constants.js`.
- `countShowrooms.js` — counters endpoint (total count by filters).
- `getShowroomById.js` — доступ: approved або owner/admin.
- `updateShowroom.js` — PATCH для draft/rejected/approved + merge contacts + editHistory.
- `update/` — patch normalization + merge/history helpers.
- `submitShowroomForReview.js` — submit → pending + duplicate checks + pendingSnapshot.
- `userShowroomState.js` — showroom favorites add/remove/list/sync у `users/{uid}/showrooms_favorites` (approved-only, idempotent, cursor pagination, guest sync with skipped ids).
- `submit/` — submit access/normalization/update helpers.
- `approveShowroom.js` — pending → approved (apply pendingSnapshot).
- `rejectShowroom.js` — pending → rejected (clear pendingSnapshot).
- `deleteShowroom.js` — soft delete (status=deleted).

### `src/test/` (bash‑тести)
- `_lib.sh` — спільні хелпери для bash‑тестів.
- `test_smoke.sh` — smoke тест публічних/базових endpoint’ів.
- `test_showrooms.sh` — owner flow, валідації, анти‑дублювання, edit/delete правила.
- `test_admin_and_collections.sh` — admin moderation + collections checks.
- `test_events_mvp1.sh` — events MVP1: list/get/want-to-visit/dismiss/idempotency.
- `test_events_guest_sync.sh` — sync guest-local events state after auth (want/dismiss merge, skipped ids, limits).
- `test_media.sh` — media seed validation + unsafe paths + order=0.
- `archive/` — старі скрипти (збережені для довідки).

### `docs/`
- `openapi.yaml` — root OpenAPI + $ref.
- `common.yaml` — shared schemas (ApiSuccess/ApiError/Auth).
- `auth.yaml`, `users.yaml`, `showrooms.yaml`, `lookbooks.yaml`, `events.yaml`, `admin.yaml` — модулі доменів.

---

## 3) Бізнес‑процеси і пов’язані файли

### A) Створення юзера (Firebase OAuth)
**Суть:** клієнт отримує Firebase ID token → бекенд перевіряє → якщо Firestore user відсутній, створює новий.
**Файли:**
- `src/routes/auth.js`
- `src/controllers/authController.js`
- `src/services/authService.js`
- `src/middlewares/auth.js`

**Логіка:**
- `verifyOAuthToken()` отримує `idToken`.
- Firebase Admin `verifyIdToken()` → `uid/email/name`.
- Якщо `users/{uid}` не існує → створюється:
  - `role: "user"`, `roles:["user"]`
  - `onboardingState: "new"`
  - `country: null`

### B) Онбординг (country)
**Суть:** це бекенд‑стан після `POST /users/complete-onboarding`.
**Файли:**
- `src/routes/user.js`
- `src/controllers/userController.js`
- `src/constants/countries.js`
- `src/middlewares/countryRestriction.js`

**Логіка:**
- Клієнт надсилає `country`.
- Якщо country відсутня → `COUNTRY_REQUIRED`.
- Якщо RU/BY → `COUNTRY_BLOCKED` (403).
- Якщо вже completed → повертає `Onboarding already completed`.

**Owner‑профіль + auto‑upgrade:**
- Endpoint: `POST /users/complete-owner-profile`
- Приймає `name`, `position` (optional), `country`, `instagram`
- Валідує інстаграм і блокує RU/BY
- Підвищує роль до `owner`

**Оновлення профілю:**
- Endpoint: `PATCH /users/profile`
- Поля: `name`, `country`, `appLanguage`, `notificationsEnabled`
- `instagram`, `position` — тільки для owner
- Якщо owner змінює країну і має активні showrooms/lookbooks/events → 409 `USER_COUNTRY_CHANGE_BLOCKED`

**Видалення профілю:**
- Endpoint: `DELETE /users/me`
- Soft delete профілю у Firestore + затирання PII.
- Owner блокується, якщо має **будь‑які** showrooms або інші assets → 409 `USER_DELETE_BLOCKED`.
- Після видалення `GET /users/me` → 404 `USER_NOT_FOUND`.

### C) Ролі та доступи
**Суть:** доступ до showroom‑операцій лише owner.
**Файли:**
- `src/constants/roles.js`
- `src/middlewares/role.js`
- `src/routes/showrooms.js`

**Логіка:**
- `requireRole([OWNER])` блокує user/guest.
- `POST /users/complete-owner-profile` доступний user/owner та автоматично підвищує роль до owner.

### D) Draft Showroom Flow (multi‑step)
**Суть:** створення чернетки → часткові PATCH → submit.
**Файли:**
- `src/routes/showrooms.js`
- `src/controllers/showroomController.js`
- `src/services/showrooms/createDraftShowroom.js`
- `src/services/showrooms/updateShowroom.js`
- `src/services/showrooms/submitShowroomForReview.js`
- `src/utils/showroomValidation.js`
- `src/schemas/showroom.*.schema.js`

**Логіка:**
- `POST /showrooms/draft` → створює або повертає існуючу draft.
- PATCH дозволено для `draft/rejected/approved`. При `pending` — lock.
- Submit дозволено для `draft/rejected/approved`, переводить в `pending` + `submittedAt` + `pendingSnapshot`.
- DELETE — soft delete (status=`deleted`) для owner через `/showrooms/{id}`; admin видаляє через `/admin/showrooms/{id}`. Owner не може коли `pending`.
**Додатково:** країна showroom повинна збігатися з країною owner; зміна на іншу країну блокується.

### E) Валідації і нормалізація
**Суть:** анти‑спам та форматування полів.
**Файли:**
- `src/utils/showroomValidation.js`
- `src/middlewares/schemaValidate.js`

**Правила:**
- name: 2..60, не тільки цифри/символи, без 5+ повторів, без emoji.
- instagram: тільки `instagram.com`.
- phone: **E.164 тільки**, починається з `+`.
- address: `normalizeAddress()` → `addressNormalized`.

### F) Анти‑дублі (owner + global)
**Суть:**
- owner duplicate → `nameNormalized` однаковий у цього owner.
- global duplicate → `nameNormalized + addressNormalized` у pending/approved.
**Файли:**
- `src/services/showrooms/submitShowroomForReview.js`

### G) Публічний каталог showrooms
**Суть:** гості бачать лише `approved`, owner — свої без `deleted`, admin бачить всі.
**Файли:**
- `src/services/showrooms/listShowrooms.js`
- `src/services/showrooms/getShowroomById.js`

**Search параметри:**
- `limit`: 1..100, default 20.
- `fields`: `marker` або `card`.
- `q`: prefix search по `nameNormalized` (якщо не задано `city`/`qMode=city`).
- `city`: exact match по `geo.cityNormalized`.
- `brand`: exact match по `brandsMap.<brandKey>` (клієнтська фіча для MVP2; API вже доступний).
- `categoryGroup`
- `subcategories` (array-contains-any)
- `category` або `categories` (список).
- `geohashPrefix` або `geohashPrefixes[]`.
- `cursor`: base64 JSON (v2) з полями `{v,f,d,value,id}`.

**Suggestions & Counters:**
- `GET /showrooms/suggestions` — підказки для пошуку (q required, `q.length < 2` → []).
- `GET /showrooms/counters` — лічильник за поточними фільтрами.
- `suggestions`: geo параметри не підтримуються.
- `suggestions`: brand-підказки доступні в API, але клієнт MVP1 може їх ігнорувати.
- `counters`: `cursor/fields/limit` відхиляються, `geohashPrefix(es) + q` → `QUERY_INVALID`.
- `suggestions/counters`: `categoryGroup`, `subcategories`, `categories` взаємовиключні (2+ → `QUERY_INVALID`).

Примітка: шоуруми з заблокованих країн тихо виключаються з публічного списку.

**Пагінація (backend‑owned):**
- Клієнт слідує тільки `meta.nextCursor`, без локального мерджу/дедупу.
- `meta.paging`: `enabled` (є сторінки), `end` (кінець/порожній список), `disabled` (пагінація недоступна).

**Обмеження курсора:**
- cursor працює тільки для одного `geohashPrefix`.
- cursor **не** підтримується для `geohashPrefixes[]` (paging disabled).
- `geohashPrefix(es) + q` → `QUERY_INVALID`.

## Prod write guard (tests)
Write‑тести відмовляються працювати з production URL без явного дозволу:
```bash
ALLOW_PROD_WRITE=1
```

**Помилки валідації:**
- `QUERY_INVALID` — некоректні параметри.
- `CURSOR_INVALID` — некоректний курсор.

## 4) Деталізовані флоу (developer view)

### 4.1) Створення user (Firebase OAuth → Firestore)
**Endpoint:** `POST /auth/oauth`
**Файли:**
- `src/routes/auth.js`
- `src/controllers/authController.js`
- `src/services/authService.js`
- `src/config/firebase.js`

**Кроки логіки:**
1. Клієнт надсилає `idToken` у body.
2. `verifyOAuthToken()` перевіряє токен через Firebase Admin.
3. Якщо user doc відсутній у Firestore → створюється `users/{uid}`:
   - `role: "user"`, `roles: ["user"]`
   - `onboardingState: "new"`
   - `country: null`
4. Якщо user вже існує → повертається існуючий документ.

### 4.2) Онбординг у бекенді (country)
**Endpoint:** `POST /users/complete-onboarding`
**Файли:**
- `src/routes/user.js`
- `src/controllers/userController.js`
- `src/constants/countries.js`

**Кроки логіки:**
1. Клієнт надсилає `country` (форма профілю).
2. Якщо `country` відсутня → `COUNTRY_REQUIRED`.
3. Якщо `country` у RU/BY → `COUNTRY_BLOCKED` (403).
4. Якщо `onboardingState === "completed"` → "Onboarding already completed".
5. Інакше → записує `country` + `onboardingState: "completed"`.

**Важливо:** бекенд **не може визначити країну сам**. Вона приходить тільки від клієнта.

### 4.3) Owner‑профіль + автоматичний upgrade
**Endpoint:** `POST /users/complete-owner-profile`
**Файли:**
- `src/routes/user.js`
- `src/controllers/userController.js`
- `src/utils/showroomValidation.js` (валидація instagram)

**Кроки логіки:**
1. Приймає `name`, `position` (optional), `country`, `instagram`.
2. Блокує `COUNTRY_BLOCKED` для RU/BY.
3. Валідує `instagram`.
4. Оновлює user doc і виставляє `role=owner`, `roles=["owner"]`.

### 4.4) Showroom: draft/approved → patch → submit → pending
**Endpoints:**
- `POST /showrooms/draft`
- `PATCH /showrooms/{id}`
- `POST /showrooms/{id}/submit`

**Файли:**
- `src/routes/showrooms.js`
- `src/controllers/showroomController.js`
- `src/services/showrooms/createDraftShowroom.js`
- `src/services/showrooms/updateShowroom.js`
- `src/services/showrooms/submitShowroomForReview.js`
- `src/utils/showroomValidation.js`

**Кроки логіки:**
1. **Draft створення:** або повертає існуючий draft, або створює мінімальний документ.
2. **PATCH:** дозволено для `draft/rejected/approved`. При `pending` — заборонено.
3. **Submit:** перевіряє completeness, дублікати, country‑guards, переводить в `pending` і створює `pendingSnapshot`.
4. **Approve/Reject (admin):** `pending` → `approved` (apply snapshot) або `rejected` (clear snapshot). Операції виконуються атомарно у Firestore transaction.
5. **Delete:** soft delete (status=`deleted`).
6. **Audit:** кожна дія пишеться в `editHistory` з diff.

### 4.5) Валідації та нормалізація
**Файли:** `src/utils/showroomValidation.js`, `src/middlewares/schemaValidate.js`

- name: 2–60, не тільки цифри/символи, без 5+ повторів, без emoji.
- phone: тільки E.164 (`+` на початку).
- instagram: тільки `instagram.com` з handle.
- address: normalize → `addressNormalized`.
- submit completeness: всі required поля мають бути присутні.

### 4.6) Анти‑дублі
**Файли:** `src/services/showrooms/submitShowroomForReview.js`

- **Owner duplicate:** same `nameNormalized` у цього owner.
- **Global duplicate:** same `nameNormalized + addressNormalized` у `pending/approved`.

---
