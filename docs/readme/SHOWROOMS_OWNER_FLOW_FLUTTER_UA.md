# Showrooms Owner Flow для Flutter

Коротка інструкція для mobile-команди по створенню, редагуванню та відправці showroom на модерацію.

Base URL:

- `https://<render-domain>/api/v1`

## 1. Передумови

- користувач має бути авторизований;
- користувач має мати роль `owner`;
- у protected endpoints передавати `Authorization: Bearer <Firebase ID token>`.

Перед стартом flow:

1. Викликати `GET /users/me`
2. Переконатися, що `data.role === "owner"`
3. Використовувати `data.country` як owner country source-of-truth і передавати country в одному узгодженому форматі в межах запиту

Важливо:

- країна showroom має збігатися з `users.me.country` за нормалізованою country identity;
- backend приймає як ISO2 (`UA`), так і full name (`Ukraine`) і порівнює їх як одну країну;
- `country` і `geo.country` в одному showroom payload теж мають описувати ту саму країну;
- `POST /showrooms/create` створює тільки `draft`;
- showroom не потрапляє на модерацію без окремого `POST /showrooms/{id}/submit`.

## 2. Правильний порядок викликів

### Варіант A. Створення одразу з даними

1. `POST /showrooms/create`
2. Зберегти `data.showroom.id`
3. Якщо потрібно ще щось змінити: `PATCH /showrooms/{id}`
4. Коли форма повністю готова: `POST /showrooms/{id}/submit`

### Варіант B. Спочатку пустий draft

1. `POST /showrooms/draft`
2. Зберегти `data.showroom.id`
3. Поступово оновлювати через `PATCH /showrooms/{id}`
4. Коли форма повністю готова: `POST /showrooms/{id}/submit`

## 3. Статуси showroom

- `draft` — showroom створений, але ще не відправлений на модерацію
- `pending` — showroom відправлений на модерацію
- `approved` — showroom схвалений адміном
- `rejected` — showroom відхилений; owner може відредагувати і відправити повторно
- `deleted` — soft deleted, не редагується як активний showroom

## 4. Мінімальний happy path

1. `GET /users/me`
2. `POST /showrooms/create`
3. Зберегти `showroom.id`
4. `POST /showrooms/{id}/submit`

Якщо create викликаний успішно, але submit не викликаний, showroom залишиться у `draft`.

## 5. Що передавати у payload

Критично важливі поля:

- `name`
- `type` — тільки `multibrand` або `unique`
- `country`
- `availability` — тільки `open` або `appointment`
- `address`
- `contacts.phone`
- `contacts.instagram`
- `geo.city`
- `geo.country`
- `geo.coords.lat`
- `geo.coords.lng`

### Geo

Canonical geo-поля:

- `geo.city`
- `geo.country`
- `geo.coords.lat`
- `geo.coords.lng`

Backend сам:

- рахує `geo.cityNormalized`
- рахує `geo.geohash`
- синхронізує compatibility-поля `city` і `location`

Flutter не повинен сам контролювати:

- `nameNormalized`
- `addressNormalized`
- `brandsNormalized`
- `brandsMap`
- `geo.cityNormalized`
- `geo.geohash`

## 6. Що робити після create

Після успішного `POST /showrooms/create` потрібно:

1. взяти `response.data.showroom.id`
2. зберегти цей `id` у state
3. всі наступні `PATCH` і `submit` робити тільки з цим `id`

Не можна:

- вважати `create` завершенням owner flow
- очікувати, що showroom стане публічним одразу після `create`

## 7. Що робити після submit

Після `POST /showrooms/{id}/submit`:

- showroom переходить у `pending`
- owner більше не може редагувати його
- рішення далі приймає адмін:
  - approve
  - або reject

Якщо showroom відхилений:

1. отримати його поточний стан
2. відредагувати через `PATCH /showrooms/{id}`
3. повторно викликати `POST /showrooms/{id}/submit`

## 8. Типові помилки

- `ACCESS_DENIED`
  - showroom country не збігається з `users.me.country` за нормалізованою country identity
- `COUNTRY_BLOCKED`
  - blocked country policy
- `VALIDATION_ERROR`
  - невалідний payload або enum
- `SHOWROOM_INCOMPLETE`
  - викликано submit, але showroom ще не заповнений повністю
- `SHOWROOM_LOCKED_PENDING`
  - спроба редагувати або видалити showroom у статусі `pending`
- `SHOWROOM_NAME_ALREADY_EXISTS`
  - у цього owner вже є showroom з такою самою нормалізованою назвою за тією самою адресою
- `SHOWROOM_DUPLICATE`
  - глобальний duplicate для moderation flow по комбінації name + address в іншого pending/approved showroom
- `SHOWROOM_RECREATE_COOLDOWN`
  - занадто рання повторна спроба створити той самий showroom після soft delete; для `submit` існуючого showroom цей код не використовується

## 9. Важливі правила для Flutter

- після кожного успішного `create` або `draft` зберігати `showroom.id`
- не домислювати статус showroom локально; брати його з відповіді бекенду
- не вважати `draft` опублікованим showroom
- не пропускати `submit`
- не розраховувати на власну нормалізацію derived полів; backend рахує їх сам
- тримати `country` і `geo.country` узгодженими в межах одного payload
- якщо є сумнів, логувати повний request body, response body і `showroom.id`

## 10. Короткий приклад

### 1. Create

```http
POST /showrooms/create
```

```json
{
  "name": "Test6",
  "type": "unique",
  "availability": "open",
  "address": "Białej Floty 2A, Warszawa, Poland",
  "country": "Poland",
  "contacts": {
    "phone": "+48111111111",
    "instagram": "https://www.instagram.com/t"
  },
  "geo": {
    "city": "Warszawa",
    "country": "Poland",
    "coords": {
      "lat": 52.195130179945224,
      "lng": 20.9844565205276
    }
  }
}
```

### 2. Submit

```http
POST /showrooms/{id}/submit
```

Після цього showroom має перейти з `draft` у `pending`.
