# JM Showroomer Backend — Покрокове тестування в Postman
> Аудиторія: внутрішні manual API перевірки для dev/QA.

---

## 0) Передумови

1. Сервер запущений:
   - `NODE_ENV=dev npm run dev` або `NODE_ENV=test npm run dev`.
2. Є `.env.dev` або `.env.test` з валідними Firebase конфігами.
3. Якщо тестуєш Storage/Media або емулюєш Firestore — піднятий емулатор (за потреби):
   - `firebase emulators:start --only firestore`.

---

## 1) Налаштування Postman

### 1.1. Створити Collection
- Назва: `JM Showroomer API`

### 1.2. Environment змінні
Створи Environment `JM Dev` з такими змінними:

- `baseUrl` → `http://localhost:3005/api/v1` (або свій host)
- `idToken_owner` → (Firebase ID token для owner)
- `idToken_owner2` → (додатковий owner для глобальних дублювань)
- `idToken_admin` → (Firebase ID token для admin)
- `idToken_user` → (звичайний user)
- `idToken_delete_user` → (throwaway user для DELETE /users/me)
- `showroomId` → (буде заповнюватись під час тестів)
- `showroomId2` → (другий showroom)
- `adminShowroomId` → (шоурум для адмін‑флоу)
- `now` → (timestamp, наприклад `{{timestamp}}` можна ставити вручну)

### 1.3. Загальні заголовки
Для захищених endpoint:
- `Authorization: Bearer {{idToken_owner}}`
- `Content-Type: application/json`

Для публічних — без Authorization.

---

## 2) Health + Public

### 2.1. Health
- **GET** `{{baseUrl}}/health`
- Очікування: `200`, `status=ok ✅`

### 2.2. Public list
- **GET** `{{baseUrl}}/showrooms`
- Очікування: `200`, тільки `approved`.

### 2.2.1. Public list (search examples)
- **GET** `{{baseUrl}}/showrooms?city=Kyiv&limit=20&fields=marker`
- **GET** `{{baseUrl}}/showrooms?q=ate&fields=card`
- **GET** `{{baseUrl}}/showrooms?brand=gucci&limit=10`
- **GET** `{{baseUrl}}/showrooms?categoryGroup=clothing`
- **GET** `{{baseUrl}}/showrooms?subcategories=dresses,suits`
- **GET** `{{baseUrl}}/showrooms?brand=zara&subcategories=dresses`
- **GET** `{{baseUrl}}/showrooms?geohashPrefix=u9yx8`
- **GET** `{{baseUrl}}/showrooms?geohashPrefixes=u9yx8,u9yx9` (cursor not supported)

Validation errors:
- `QUERY_INVALID` for invalid params or unsupported combinations
- `CURSOR_INVALID` for invalid cursor format
  - Cursor v2 format: `{v:2,f,d,value,id}` (base64 JSON)

### 2.3. Lookbooks public
- **GET** `{{baseUrl}}/lookbooks?country=Ukraine&seasonKey=ss-2026`
- Очікування: `200`, тільки published.
- Без `country` або `seasonKey` -> `400 QUERY_INVALID`.

### 2.4. Events RSVP (MVP2-only)
- **POST** `{{baseUrl}}/events/{id}/rsvp`
- Header: `Authorization: Bearer {{idToken_owner}}`
- Очікування: `501 EVENTS_WRITE_MVP2_ONLY`.

### 2.4.1. Lookbooks RSVP (stub)
- **POST** `{{baseUrl}}/lookbooks/{id}/rsvp`
- Header: `Authorization: Bearer {{idToken_owner}}`
- Очікування: `200`, same stub response.

### 2.5. Collections checks
- **GET** `{{baseUrl}}/collections/favorites/showrooms`
- **POST** `{{baseUrl}}/collections/favorites/showrooms/sync`
- **GET** `{{baseUrl}}/collections/favorites/lookbooks`
- **GET** `{{baseUrl}}/collections/want-to-visit/events`
- Очікування:
  - `favorites/showrooms`: `200` (public route; guest returns empty, auth returns user favorites)
  - `favorites/lookbooks`: `200` (public-compatible; guest returns empty, auth returns user favorites)
  - `want-to-visit/events`: `200` (public-compatible; guest returns empty, auth returns user state)
  - `POST /lookbooks/{id}/favorite` та `DELETE /lookbooks/{id}/favorite`:
    - без auth -> `401 AUTH_MISSING`
    - з auth -> `200`, idempotent
  - `POST /collections/favorites/showrooms/sync` (auth):
    - payload: `{ "favoriteIds": ["<approved_showroom_id>", "<missing_or_non_approved_id>"] }`
    - `200`, `applied.favorites` містить лише approved ids, решта у `skipped`
  - `POST /collections/favorites/showrooms/sync` з `favoriteIds > 100` -> `400 SHOWROOM_SYNC_LIMIT_EXCEEDED`
  - `POST /collections/favorites/lookbooks/sync` з `favoriteIds > 100` -> `400 LOOKBOOK_SYNC_LIMIT_EXCEEDED`

---

## 3) Auth

### 3.1. OAuth login (optional, якщо хочеш перевірити)
- **POST** `{{baseUrl}}/auth/oauth`
- Body:
```json
{ "idToken": "<firebase-id-token>" }
```
- Очікування: `200` + дані user.

### 3.2. Users/me
- **GET** `{{baseUrl}}/users/me`
- Header: `Authorization: Bearer {{idToken_owner}}`
- Очікування: `200` + `role`, `onboardingState`.

### 3.3. User delete (throwaway)
- **DELETE** `{{baseUrl}}/users/me`
- Header: `Authorization: Bearer {{idToken_delete_user}}`
- Очікування: `200`.
- **GET** `{{baseUrl}}/users/me` → `404 USER_NOT_FOUND`.
- **DELETE** повторно → `200` (idempotent).

---

## 4) Onboarding + Owner profile

### 4.1. Complete onboarding
- **POST** `{{baseUrl}}/users/complete-onboarding`
- Header: Bearer `{{idToken_user}}`
- Body:
```json
{ "country": "Ukraine" }
```
- Очікування: `200`.

### 4.2. Owner profile (upgrade)
- **POST** `{{baseUrl}}/users/complete-owner-profile`
- Header: Bearer `{{idToken_user}}`
- Body:
```json
{ "name": "Owner Test", "position": "Founder", "country": "Ukraine", "instagram": "https://instagram.com/owner_test" }
```
- Очікування: `200`, `role=owner`.

### 4.3. Profile update
- **PATCH** `{{baseUrl}}/users/profile`
- Header: Bearer `{{idToken_owner}}`
- Body:
```json
{ "name": "Owner Test Updated", "appLanguage": "uk", "notificationsEnabled": true }
```
- Очікування: `200`.

---

## 5) Showrooms — Draft Flow

### 5.1. Create draft
- **POST** `{{baseUrl}}/showrooms/draft`
- Header: Bearer `{{idToken_owner}}`
- Body: `{}`
- Очікування: `200` + `status=draft`.
- Збережи `id` в `showroomId`.

### 5.2. PATCH step1 (name/type)
- **PATCH** `{{baseUrl}}/showrooms/{{showroomId}}`
- Body:
```json
{ "name": "My Showroom {{now}}", "type": "multibrand" }
```
- Очікування: `200`.

### 5.3. PATCH step2 (country/availability)
```json
{ "country": "Ukraine", "availability": "open" }
```

### 5.4. PATCH step3 (address/city/location)
```json
{ "address": "Kyiv, Khreshchatyk 1", "city": "Kyiv", "location": { "lat": 50.45, "lng": 30.52 } }
```

### 5.5. PATCH geo (MVP1)
```json
{ "geo": { "city": "Kyiv", "country": "Ukraine", "coords": { "lat": 50.4501, "lng": 30.5234 }, "placeId": "test-place-1" } }
```
Очікування: `geo.cityNormalized` і `geo.geohash` у відповіді.

### 5.6. PATCH geo update
```json
{ "geo": { "city": "Lviv", "country": "Ukraine", "coords": { "lat": 49.8397, "lng": 24.0297 }, "placeId": "test-place-2" } }
```
Очікування: оновився `geo`.

### 5.7. PATCH contacts
```json
{ "contacts": { "phone": "+380999999999", "instagram": "https://instagram.com/myshowroom" } }
```

### 5.8. GET showroom
- **GET** `{{baseUrl}}/showrooms/{{showroomId}}`
- Очікування: всі поля заповнені.

---

## 6) Submit / Pending / Approve

### 6.1. Submit
- **POST** `{{baseUrl}}/showrooms/{{showroomId}}/submit`
- Очікування: `status=pending`, `pendingSnapshot` існує.

### 6.2. PATCH pending (має бути lock)
- **PATCH** `{{baseUrl}}/showrooms/{{showroomId}}`
- Body: `{ "name": "Should Fail" }`
- Очікування: `409 SHOWROOM_LOCKED_PENDING`.

### 6.3. Admin approve
- Header: Bearer `{{idToken_admin}}`
- **POST** `{{baseUrl}}/admin/showrooms/{{showroomId}}/approve`
- Очікування: `status=approved`, `pendingSnapshot=null`, `geo` збережений.

---

## 7) Search

### 7.1. City filter
- **GET** `{{baseUrl}}/showrooms?city=Lviv`
- Очікування: showroom присутній у списку (approved).

### 7.2. Suggestions
- **GET** `{{baseUrl}}/showrooms/suggestions?q=to`
- Очікування: масив `suggestions` з типом `showroom` або `brand`.
- **GET** `{{baseUrl}}/showrooms/suggestions?q=to&categories=womenswear&categoryGroup=clothing` → `400 QUERY_INVALID` (mutually exclusive filters)

### 7.3. Counters
- **GET** `{{baseUrl}}/showrooms/counters?city=Kyiv`
- **GET** `{{baseUrl}}/showrooms/counters?categoryGroup=clothing&subcategories=dresses` → `400 QUERY_INVALID` (mutually exclusive filters)
- Очікування: `data.total` дорівнює кількості approved шоурумів у Kyiv.

---

## 8) Duplicates (owner + global)

### 8.1. Create second showroom
- **POST** `{{baseUrl}}/showrooms/create`
- Header: Bearer `{{idToken_owner}}`
- Body:
```json
{ "name": "Seed Showroom", "type": "multibrand", "country": "Ukraine" }
```
- Збережи id в `showroomId2`.

### 8.2. PATCH (duplicate name)
```json
{ "name": "My Showroom {{now}}", "availability": "open", "address": "Kyiv, Khreshchatyk 1", "city": "Kyiv", "contacts": { "phone": "+380999999999", "instagram": "https://instagram.com/myshowroom" }, "location": { "lat": 50.45, "lng": 30.52 } }
```
- **POST** submit → очікування: `SHOWROOM_NAME_ALREADY_EXISTS`.

### 8.3. Global duplicate (owner2)
- **POST** draft (owner2)
- PATCH тим самим `name+address`
- **POST** submit → очікування: `SHOWROOM_DUPLICATE`.

---

## 9) Admin flows

### 9.1. Admin reject
- **POST** `{{baseUrl}}/admin/showrooms/{{showroomId}}/reject`
- Body: `{ "reason": "Missing details" }`
- Очікування: `status=rejected`, `pendingSnapshot=null`.

### 9.2. Owner resubmit → admin approve
- **PATCH** name
- **POST** submit
- **POST** admin approve
- Очікування: `status=approved`.

### 9.3. Admin delete
- **DELETE** `{{baseUrl}}/admin/showrooms/{{showroomId}}`
- Очікування: `status=deleted`.

---

## 10) Negative cases

- PATCH name digits only → `SHOWROOM_NAME_INVALID`.
- PATCH invalid instagram → `INSTAGRAM_INVALID`.
- PATCH invalid phone → `PHONE_INVALID`.
- PATCH country blocked (Russia) → `COUNTRY_BLOCKED`.

---

## 11) Geo model rules (контроль)

- `geo` **не видаляється** через PATCH (не передавати `null`).
- `geo` оновлюється лише повним обʼєктом.
- `geo.cityNormalized` та `geo.geohash` завжди повертаються сервером.
- `country` — повна назва (наприклад `Ukraine`), **не** ISO2.
- `location` — legacy, `geo.coords` — канонічні для пошуку.

---

## 12) Медіа (optional)

Залежить від Storage/seed. Ручна перевірка:
- **GET** `/lookbooks` → coverUrl існує та є URL.
- Перевірити signed URL (відкривається в браузері).

---

## 13) Завершення

Якщо всі кроки проходять з очікуваними статусами — бекенд готовий до інтеграції та QA.
