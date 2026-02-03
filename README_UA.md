# JM Showroomer Backend

## Що робить бекенд
Бекенд JM Showroomer — це серверна частина, яка забезпечує:
- авторизацію користувачів через Firebase;
- зберігання даних шоурумів у Firestore;
- бізнес‑правила створення та модерації шоурумів;
- контроль ролей і доступів;
- валідації даних (ім’я, телефон, інстаграм, країни);
- анти‑дублі та анти‑спам логіку.
- налаштування профілю користувача (PATCH /users/profile).

## Що вже виконано
- **Авторизація через Firebase ID token**.
- **Онбординг користувача** з перевіркою країни.
- **Ролі**: guest | user | owner | admin.
- **Showroom draft flow**:
  - створення чернетки,
  - збереження по кроках,
  - submit на модерацію.
- **Валідації**:
  - назва шоуруму,
  - телефон (E.164),
  - Instagram URL.
- **Блок країн**: russia / belarus (RU/BY).
- **Анти‑дублі**:
  - дубль імені для власника,
  - глобальний дубль (name + address) у pending/approved.
- **Оновлення профілю** через `PATCH /users/profile`.
- **API контракт** у OpenAPI (`docs/openapi.yaml` + модульні файли).
- **E2E тести** через bash скрипти.

## Основні флоу (як працює для бізнесу)

### 0) Флоу в додатку (UX рівень)
1. Splash/лого → onboarding слайди UI.
2. Екран вибору: перегляд шоурумів / створити шоурум / login‑register.
3. Після логіну користувач може обрати створення шоуруму.
4. Якщо обрав створення — заповнює owner‑профіль (імʼя/країна/instagram/посада опц.).
5. Після цього отримує роль owner і може створювати шоуруми.

### 1) Авторизація
- Мобільний клієнт логіниться через Firebase.
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

### 3) Профіль власника (без модерації користувача)
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

**Статуси:**
- `draft` — чернетка (редагується),
- `pending` — відправлено на модерацію (owner не може редагувати/видаляти),
- `approved` — підтверджено,
- `rejected` — відхилено (можна виправити та відправити знову),
- `deleted` — soft delete (приховано з публічних/owner списків).
**Модерується лише шоурум, не користувач.**

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

## Де дивитися повний контракт API
- `docs/openapi.yaml`
- Додаткові модулі в `docs/` (auth, users, showrooms, lookbooks тощо).
