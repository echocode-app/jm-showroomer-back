# JM Showroomer Backend

## Що робить бекенд
JM Showroomer Backend забезпечує:
- авторизацію через Firebase;
- зберігання шоурумів у Firestore;
- бізнес‑правила створення та модерації;
- контроль ролей і доступів;
- валідації даних (ім’я, телефон, Instagram, країни);
- анти‑дублі;
- профіль користувача.

## Що вже виконано
- **Авторизація через Firebase ID token (Google/Apple/any)**.
- **Онбординг користувача** з перевіркою країни.
- **Ролі**: guest | user | owner | admin (майбутні: manager, stylist).
- **MVP2-резерв**: `role` зі значеннями `manager`/`stylist` та `roleRequest` зарезервовані для MVP2. Клієнти MVP1 мають їх ігнорувати, якщо вони присутні.
- **Showroom draft flow**: чернетка → поетапні PATCH → submit.
- **Geo model (MVP1)**: `geo` (місто + країна + координати + geohash), фільтр `GET /showrooms?city=...`.
- **Lookbooks & Events**: самостійні сутності (MVP1: lookbooks list/detail + favorites/sync, events list + want-to-visit/dismiss).
- **Валідації**: назва шоуруму, телефон (E.164), Instagram URL.
- **Блок країн**: russia / belarus (RU/BY).
- **Анти‑дублі**: дубль імені для власника, глобальний дубль (name + address) у pending/approved.
- **Оновлення профілю** через `PATCH /users/profile`.
- **Видалення профілю** через `DELETE /users/me` (soft delete + затирання PII; owner блокується, якщо має будь‑які showrooms/assets).
- **API контракт** у OpenAPI (`docs/openapi.yaml` + модульні файли).
- **E2E тести** через bash скрипти.

## Search & Pagination (Showrooms)
- `limit`: 1..100, default 20
- `fields`: `marker` або `card`
- `q`: prefix search по `nameNormalized` (ігнорується, якщо задано `city` або `qMode=city`)
- `city`: exact match по `geo.cityNormalized`
- `brand`: exact match по `brandsMap.<brandKey>` (фіча клієнта для MVP2; API вже доступний)
- `categoryGroup`
- `subcategories` (array-contains-any)
- `geohashPrefix` або `geohashPrefixes[]`
- `cursor`: base64 JSON (v2) з полями `{v,f,d,value,id}`

Пагінація (backend‑owned):
- Клієнт слідує тільки `meta.nextCursor`, без локального мерджу/дедупу.
- `meta.paging`: `enabled` (є сторінки), `end` (кінець/порожній список), `disabled` (пагінація недоступна).
- cursor працює тільки для одного `geohashPrefix`.
- cursor **не** підтримується для `geohashPrefixes[]` (paging disabled).
- `geohashPrefix(es) + q` → `QUERY_INVALID`.

Помилки валідації:
- `QUERY_INVALID`
- `CURSOR_INVALID`

Реалізація пошуку:
- `src/services/showrooms/listShowrooms.js` (entry)
- `src/services/showrooms/list/` (parse/utils/ordering/dev/firestore + shared `devFilters.js`)

## Suggestions & Counters
- `GET /showrooms/suggestions`: легкі підказки для пошуку.
- `GET /showrooms/counters`: лічильник за поточними фільтрами.
- внутрішня реалізація suggestions винесена в `src/services/showrooms/suggest/` (`dev`, `firestore`, `builders`, `constants`).
- `suggestions`: `q` обовʼязковий; `q.length < 2` повертає `[]`.
- `suggestions`: geo параметри не підтримуються.
- `suggestions`: brand-підказки доступні в API, але клієнт MVP1 може їх ігнорувати.
- `counters`: `q` опційний; `cursor/fields/limit` відхиляються.
- `counters`: `geohashPrefix(es) + q` → `QUERY_INVALID`.
- `suggestions/counters`: `categoryGroup`, `subcategories`, `categories` взаємовиключні (2+ → `QUERY_INVALID`).

Індекс:
- `INDEX_NOT_READY` означає, що Firestore не має потрібного композитного індексу; перед релізом задеплойте індекси.

## Основні флоу (як працює для бізнесу)

### 0) Флоу в додатку (UX рівень)
1. Splash/лого → onboarding слайди UI.
2. Екран вибору: перегляд шоурумів / створити шоурум / login‑register.
3. Після логіну користувач може обрати створення шоуруму.
4. Якщо обрав створення — заповнює owner‑профіль (імʼя/країна/instagram/посада опц.).
5. Після цього отримує роль owner і може створювати шоуруми.

### 1) Авторизація
- Мобільний клієнт логіниться через Firebase (Google/Apple).
- Отриманий `idToken` передається в бекенд:
  `Authorization: Bearer <token>`.

### 2) Онбординг
- Користувач обирає країну (з форми профілю):
  `POST /users/complete-onboarding`.
- Якщо країна заблокована (russia, belarus) → 403 COUNTRY_BLOCKED.
**Важливо:** бекенд не визначає країну сам — вона приходить від клієнта.

### 2.1) Owner‑профіль + автоматичний upgrade
**Endpoint:** `POST /users/complete-owner-profile`

**Що робить:**
- приймає `name`, `position` (optional), `country`, `instagram`;
- блокує russia/belarus (COUNTRY_BLOCKED);
- валідує `instagram`;
- виставляє `role = owner` і `roles = ["owner"]`.

### 3) Профіль власника
- Якщо користувач хоче створювати шоуруми, він **додатково заповнює профіль**:
  - ім’я
  - посада (необов’язково)
  - країна
  - Instagram
**Модерація користувача не проводиться.** Модерація стосується лише шоурумів.
**Роль owner присвоюється автоматично** після `complete-owner-profile`.

### 3.1) Оновлення профілю
**Endpoint:** `PATCH /users/profile`

Дозволені поля:
- `name`, `country`, `appLanguage`, `notificationsEnabled`
- `instagram`, `position` (тільки для owner)

**Зміна країни для owner:**
якщо є активні шоуруми або лукбуки/івенти → 409 `USER_COUNTRY_CHANGE_BLOCKED`  
Повідомлення: «Щоб змінити країну, видаліть свої шоуруми та лукбуки або створіть новий акаунт».

### 3.2) Видалення профілю
**Endpoint:** `DELETE /users/me`

**Правила:**
- soft delete у Firestore (`isDeleted`, `deletedAt`) + затирання PII.
- owner блокується, якщо має **будь‑які** showrooms або інші assets → 409 `USER_DELETE_BLOCKED`.
- повторний DELETE → 200 OK.
**Після видалення:** `GET /users/me` повертає 404 `USER_NOT_FOUND`.

### 4) Створення шоуруму (draft → submit)
**Кроки:**
1. **Створення або отримання чернетки**:
   `POST /showrooms/draft`
2. **Поступове заповнення** (кілька PATCH):
   `PATCH /showrooms/{id}`
3. **Submit на модерацію**:
   `POST /showrooms/{id}/submit`

### 4.1) Geo модель (MVP1)
**Суть:** геодані приходять від клієнта, бекенд не геокодує.

**Приклад:**
```json
{
  "geo": {
    "city": "Kyiv",
    "country": "Ukraine",
    "coords": { "lat": 50.4501, "lng": 30.5234 },
    "placeId": "..."
  }
}
```

**Пошук:** `GET /showrooms?city=Kyiv` (фільтр по `geo.cityNormalized`).

**Country формат:** повна назва країни (наприклад `Ukraine`), **не** ISO2.
**Geo country:** `geo.country` має збігатися з top‑level `country` (case‑insensitive), інакше 400.

**Статуси:**
- `draft` — чернетка (редагується),
- `pending` — відправлено на модерацію (owner не може редагувати/видаляти),
- `approved` — підтверджено,
- `rejected` — відхилено (можна виправити та відправити знову),
- `deleted` — soft delete (приховано з публічних/owner списків).
**Модерується лише шоурум, не користувач.**
**Важливо:** країна шоуруму має збігатися з країною owner; змінити її на іншу не можна.

### 5) Валідації
- **Назва шоуруму:** 2–60 символів, не лише цифри, без повторів 5+ разів, без емодзі.
- **Телефон:** тільки у форматі E.164 (має починатись з +).
- **Instagram:** тільки instagram.com з handle.

### 6) Анти‑дублювання
- Заборонено створювати шоуруми з однаковою назвою для одного owner.
- Заборонено подавати на модерацію шоурум з таким самим name+address, якщо вже є pending або approved.

## Бізнес‑логіка доступу
- **guest:** тільки перегляд approved шоурумів.
- **user:** проходить онбординг, може заповнити owner‑профіль і стати owner.
- **owner:** створює та редагує свої шоуруми (draft/rejected/approved), відправляє на модерацію; не може PATCH/DELETE під час pending.
- **admin:** модерація шоурумів (approve/reject), перегляд усіх статусів, soft delete у будь‑якому статусі.

## Модерація (admin)
- `POST /admin/showrooms/{id}/approve` — approve pending
- `POST /admin/showrooms/{id}/reject` — reject pending (body: `{ reason: string }`)
- `DELETE /admin/showrooms/{id}` — soft delete any

## Колекції
- `GET /collections/favorites/showrooms` — публічно (guest/user/owner/admin), порожній список (stub)
- `GET /collections/favorites/lookbooks` — тільки auth, повертає обрані lookbooks (лише published; stale ids відфільтровуються)
- `POST /collections/favorites/lookbooks/sync` — тільки auth, sync guest-local favoriteIds після логіну
- `GET /collections/want-to-visit/events` — тільки auth, повертає upcoming events із want-to-visit.
- `POST /collections/want-to-visit/events/sync` — тільки auth, синхронізує guest-local стани подій після логіну.

## Lookbooks (MVP1)
- `GET /lookbooks`:
  - обовʼязкові фільтри `country` + `seasonKey`
  - застосовуються разом з `published=true`
  - cursor pagination (`meta.hasMore`, `meta.nextCursor`, `meta.paging`)
  - підписується тільки `coverUrl`
- `GET /lookbooks/{id}`:
  - тільки published lookbook
  - підписуються `coverUrl` і `images[].url`
- `POST /lookbooks/{id}/favorite`, `DELETE /lookbooks/{id}/favorite`:
  - тільки auth, idempotent

## Events (MVP1) — Flutter contract
- List cursor: base64 JSON `{ v: 1, startsAt: string, id: string }`.
- Параметр `city` нормалізується на бекенді перед матчингом.
- Поля для UI: `name`, `startsAt`, `endsAt`, `city`, `country`, `address`, `type`, `coverPath`, `externalUrl`.

## Guest Event Likes Flow (MVP1)
- Гість може лайкати/дизлайкати events лише локально в застосунку (без анонімних записів у Firestore).
- Після авторизації Flutter має викликати:
  - `POST /collections/want-to-visit/events/sync`
- Payload:
  - `{ wantToVisitIds: string[], dismissedIds: string[] }`
- Обмеження:
  - максимум 100 id у кожному списку (`EVENT_SYNC_LIMIT_EXCEEDED` при перевищенні)
  - якщо id є в обох списках, пріоритет має `wantToVisit`
  - неіснуючі, unpublished, past або blocked-country events повертаються в `skipped`

## Аудит і зміни
- Кожна дія (patch/submit/approve/reject/delete) додається в `editHistory` з diff.
- На submit створюється `pendingSnapshot` для незмінної перевірки.

## Media/Storage (MVP1)
- Медіа зберігаються за канонічними шляхами у Storage (наприклад, `lookbooks/{id}/cover/{file}.webp`).
- Клієнт отримує короткочасні signed URL (наприклад, `coverUrl`) для читання.
- Завантаження файлів — MVP2; у MVP1 використовується лише seed‑контент.

## Де дивитися повний контракт API
- `docs/openapi.yaml`
- Додаткові модулі в `docs/` (auth, users, showrooms, lookbooks тощо).

## Firestore індекси для Events (MVP1)
- Якщо `/events` повертає `503 INDEX_NOT_READY`, треба задеплоїти/дочекатись композитних індексів.
- Команда деплою:
  - `firebase deploy --only firestore:indexes --project <project-id>`
- Обовʼязкові комбінації:
  - `published + startsAt + __name__`
  - `published + country + startsAt + __name__`
  - `published + cityNormalized + startsAt + __name__`
  - `published + country + cityNormalized + startsAt + __name__`

## Dev‑ендпоінти (лише для dev/test)
Ці роути **не входять у OpenAPI** і мають використовуватись тільки локально:
- `POST /users/dev/register-test`
- `POST /users/dev/make-owner`
