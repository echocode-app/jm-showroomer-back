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
- **Geo model (MVP1)**: `geo` (місто + координати + geohash), фільтр `GET /showrooms?city=...`.
- **Валідації**: назва шоуруму, телефон (E.164), Instagram URL.
- **Блок країн**: russia / belarus (RU/BY).
- **Анти‑дублі**: дубль імені для власника, глобальний дубль (name + address) у pending/approved.
- **Оновлення профілю** через `PATCH /users/profile`.
- **API контракт** у OpenAPI (`docs/openapi.yaml` + модульні файли).
- **E2E тести** через bash скрипти.

## Search & Pagination (Showrooms)
- `limit`: 1..100, default 20
- `fields`: `marker` або `card`
- `q`: prefix search по `nameNormalized` (ігнорується, якщо задано `city` або `qMode=city`)
- `city`: exact match по `geo.cityNormalized`
- `brand`: exact match по `brandsNormalized`
- `geohashPrefix` або `geohashPrefixes[]`
- `cursor`: base64 JSON з версією `v`

Обмеження курсора:
- cursor працює тільки для одного `geohashPrefix`.
- cursor **не** підтримується для `geohashPrefixes[]`.
- cursor **не** підтримується для `geohashPrefix + q`.

Помилки валідації:
- `QUERY_INVALID`
- `CURSOR_INVALID`

Реалізація пошуку:
- `src/services/showrooms/listShowrooms.js` (entry)
- `src/services/showrooms/list/` (parse/utils/ordering/dev/firestore)

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

## Колекції (UI‑стаби)
- `GET /collections/favorites/showrooms` — публічно (guest/user/owner/admin), порожній список (stub)
- `GET /collections/favorites/lookbooks` — публічно (guest/user/owner/admin), порожній список (stub)
- `GET /collections/want-to-visit/events` — публічно (guest/user/owner/admin), порожній список (stub)

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

## Dev‑ендпоінти (лише для dev/test)
Ці роути **не входять у OpenAPI** і мають використовуватись тільки локально:
- `POST /users/dev/register-test`
- `POST /users/dev/make-owner`
