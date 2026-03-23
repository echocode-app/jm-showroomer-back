# Showrooms Flutter Guide (UA)

Єдиний короткий документ для Flutter по showroom flow:
- owner flow
- list/search/card payloads
- map viewport flow
- detail payload

Base URL:

- `https://<render-domain>/api/v1`

## 1. Передумови

- користувач авторизований
- для owner flow роль має бути `owner`
- у protected endpoints передавати `Authorization: Bearer <Firebase ID token>`

Перед showroom owner flow:

1. викликати `GET /users/me`
2. перевірити `data.role === "owner"`
3. використовувати `data.country` як canonical country для showroom

Важливо:

- showroom country має збігатися з `users.me.country`
- `POST /showrooms/create` створює тільки `draft`
- для відправки на модерацію потрібен окремий `POST /showrooms/{id}/submit`

---

## 2. Owner flow

### Варіант A. Створення одразу з даними

1. `POST /showrooms/create`
2. зберегти `data.showroom.id`
3. якщо потрібно, `PATCH /showrooms/{id}`
4. коли форма готова, `POST /showrooms/{id}/submit`

### Варіант B. Через пустий draft

1. `POST /showrooms/draft`
2. зберегти `data.showroom.id`
3. оновлювати через `PATCH /showrooms/{id}`
4. коли форма готова, `POST /showrooms/{id}/submit`

### Статуси

- `draft` — створено, але не відправлено
- `pending` — на модерації
- `approved` — схвалено
- `rejected` — відхилено, можна виправити і подати повторно
- `deleted` — soft deleted

### Мінімальний happy path

1. `GET /users/me`
2. `POST /showrooms/create`
3. зберегти `showroom.id`
4. `POST /showrooms/{id}/submit`

---

## 3. Що передавати у showroom payload

Критично важливі поля:

- `name`
- `type` — `multibrand | unique`
- `country`
- `availability` — `open | appointment`
- `address`
- `contacts.phone`
- `contacts.instagram`
- `geo.city`
- `geo.country`
- `geo.coords.lat`
- `geo.coords.lng`

### Instagram format

Для `contacts.instagram` і owner profile Instagram:

- дозволені тільки `instagram.com` або `www.instagram.com`
- після домену має бути рівно один handle
- handle: `1..30` символів
- дозволені тільки: літери, цифри, `.` `_`
- не можна:
  - query params
  - hash fragments
  - додаткові path segments типу `/reel/...`
  - `..`
  - handle, що починається або закінчується на `.`

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

Flutter не повинен сам рахувати:

- `nameNormalized`
- `addressNormalized`
- `brandsNormalized`
- `brandsMap`
- `geo.cityNormalized`
- `geo.geohash`

---

## 4. Detail showroom

Для detail screen:

```http
GET /showrooms/{id}
```

У detail payload є:

- showroom основні поля
- `geo.coords.lat`
- `geo.coords.lng`

Тобто coordinates для detail screen уже можна брати прямо з `GET /showrooms/{id}`.

---

## 5. List modes

### `GET /showrooms`

Звичайний list endpoint для:

- showroom catalog
- my showrooms
- filtered lists

Default limit:

- якщо `limit` не передати, backend використовує `20`

### `fields=card`

```http
GET /showrooms?fields=card
```

Повертає card/list payload.

### `fields=marker`

```http
GET /showrooms?fields=marker
```

Повертає:

- `id`
- `name`
- `type`
- `category`
- `address`
- `city`
- `country`
- `geo.coords`

### `fields=geo`

```http
GET /showrooms?fields=geo
```

Повертає тільки:

- `id`
- `geo.coords`

`fields=geo` і `fields=marker` — це list endpoint-и, у них працює стандартний `limit/cursor`.

---

## 6. Pagination rules

Для list endpoint-ів:

- `GET /showrooms`
- `GET /showrooms?fields=card`
- `GET /showrooms?fields=marker`
- `GET /showrooms?fields=geo`

якщо `limit` не передати явно, backend бере default `20`.

Якщо елементів більше:

- `meta.hasMore = true`
- `meta.nextCursor = ...`

Наступна сторінка:

```http
GET /showrooms?...&cursor=<meta.nextCursor>
```

---

## 7. Map flow

Для карти використовувати окремий endpoint:

```http
GET /showrooms/map?north=<...>&south=<...>&east=<...>&west=<...>&zoom=<...>
```

Це viewport-based endpoint.
Для плашки exact count по тому самому viewport використовуйте:

```http
GET /showrooms/map/counters?north=<...>&south=<...>&east=<...>&west=<...>&zoom=<...>
```

Flutter має:

1. отримати bounds через `getVisibleRegion()`
2. взяти:
   - `north`
   - `south`
   - `east`
   - `west`
   - `zoom`
3. викликати `GET /showrooms/map`
4. для badge `знайдено N шоурумів` окремо викликати `GET /showrooms/map/counters`

Опційно можна додавати фільтри:

- `country`
- `city`
- `type`
- `availability`
- `category`
- `categories`
- `categoryGroup`
- `subcategories`
- `brand`

### Що повертає backend

```json
{
  "success": true,
  "data": {
    "showrooms": [
      {
        "id": "sr_123",
        "name": "Atelier Nova",
        "type": "multibrand",
        "category": "womenswear",
        "address": "Kyiv, Khreshchatyk 1",
        "city": "Kyiv",
        "country": "Ukraine",
        "status": "approved",
        "geo": {
          "coords": {
            "lat": 50.4501,
            "lng": 30.5234
          }
        }
      }
    ]
  },
  "meta": {
    "zoom": 12,
    "queryPrecision": 5,
    "prefixesCount": 4,
    "total": 1,
    "scanned": 1,
    "truncated": false
  }
}
```

### Як це використовувати

- backend повертає точки у поточному viewport
- Flutter / map SDK сам кластеризує ці точки
- на tap по pin використовується `id` для `GET /showrooms/{id}`
- для exact count у плашці треба використовувати `data.total` з `GET /showrooms/map/counters`, не `meta.total` з `GET /showrooms/map`

### Що важливо

- `/showrooms/map` не cursor-пагінований
- `limit` тут не використовується
- backend може поставити `meta.truncated = true`, якщо viewport занадто великий

Якщо `meta.truncated = true`, Flutter може:

- кластеризувати те, що прийшло
- або попросити юзера наблизити карту

### Рекомендований flow

1. користувач відкрив карту
2. Flutter бере current bounds + zoom
3. викликає `GET /showrooms/map`
4. викликає `GET /showrooms/map/counters`
5. рендерить showroom точки
6. показує `data.total` у плашці `знайдено N шоурумів`
7. локально кластеризує точки через map SDK
8. при `cameraIdle` після pan/zoom повторює обидва запити з новими bounds + zoom

---

## 8. Типові помилки owner flow

- `ACCESS_DENIED`
  - showroom country не збігається з `users.me.country`
- `COUNTRY_BLOCKED`
  - blocked country policy
- `VALIDATION_ERROR`
  - невалідний payload
- `SHOWROOM_INCOMPLETE`
  - submit викликаний занадто рано
- `SHOWROOM_LOCKED_PENDING`
  - спроба редагувати/showroom у `pending`
- `SHOWROOM_NAME_ALREADY_EXISTS`
  - у цього owner вже є showroom з тією самою назвою за тією самою адресою
- `SHOWROOM_DUPLICATE`
  - глобальний duplicate для moderation по комбінації name + address в іншого pending/approved showroom
- `SHOWROOM_RECREATE_COOLDOWN`
  - занадто рання повторна спроба після soft delete

---

## 9. Що Flutter не повинен робити

- не вважати `create` завершенням owner flow
- не пропускати `submit`
- не домислювати derived поля локально
- не будувати карту через один великий paged list feed
- не використовувати `nearRadiusKm` як заміну viewport map query, якщо вже є `visibleRegion / bounds`
- не змішувати list cursor pagination з `/showrooms/map`
- не брати число для map badge із `/showrooms/map`; для цього є `/showrooms/map/counters`
