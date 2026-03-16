# Showrooms Map — Flutter Integration Guide (UA)

## 1) Для чого цей endpoint

`GET /showrooms/map` — окремий endpoint для карти.

Він не повертає cursor-пагінацію як звичайний список.
Він повертає showroom точки тільки для поточного viewport карти.
Кластеризацію робить Flutter / map SDK.
Для плашки `знайдено N шоурумів` використовуйте окремий `GET /showrooms/map/counters`.

---

## 2) Коли його використовувати

Використовуйте `GET /showrooms/map`, коли Flutter рендерить карту.

Не використовуйте для карти звичайний `GET /showrooms` як основний source-of-truth для viewport pins.

---

## 3) Що Flutter має передавати

На кожен `cameraIdle` / завершення руху карти:

```http
GET /showrooms/map?north=<...>&south=<...>&east=<...>&west=<...>&zoom=<...>
```

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

---

## 4) Що повертає backend

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

Flutter має:

- рендерити pins
- при потребі кластеризувати їх локально через map SDK
- при tap використовувати `id` для `GET /showrooms/{id}`

Для exact badge count по тому самому viewport:

```http
GET /showrooms/map/counters?north=<...>&south=<...>&east=<...>&west=<...>&zoom=<...>
```

Приклад відповіді:

```json
{
  "success": true,
  "data": {
    "total": 856
  },
  "meta": {
    "zoom": 12,
    "queryPrecision": 5,
    "prefixesCount": 4,
    "exact": true
  }
}
```

---

## 5) Що важливо

- endpoint не cursor-пагінований
- `limit` тут не використовується
- backend сам обмежує payload
- якщо точок у viewport забагато, backend поверне `meta.truncated = true`
- якщо `meta.truncated = true`, Flutter може:
  - кластеризувати те, що отримав
  - або попросити юзера наблизити карту

---

## 6) Рекомендований flow

1. Користувач відкрив карту
2. Flutter бере current bounds + zoom
3. Викликає `GET /showrooms/map`
4. Рендерить showroom точки
5. Для плашки count окремо викликає `GET /showrooms/map/counters` з тими самими bounds + zoom
6. Локально кластеризує точки через map SDK, якщо це потрібно для поточного zoom
7. Користувач zoom in / pan
8. Після `cameraIdle` повторює обидва запити з новими bounds + zoom

---

## 7) Detail flow

Коли користувач натискає на pin:

1. взяти `pin.id`
2. викликати:

```http
GET /showrooms/{id}
```

У detail payload уже є `geo.coords`.

## 8) Що Flutter не повинен робити

- не тягнути всі showroom-и одним великим list запитом для карти
- не будувати карту через `nearRadiusKm`, якщо вже є `visibleRegion / bounds`
- не припускати, що карта = `GET /showrooms?fields=geo`
- не змішувати cursor pagination списку з viewport map behavior
- не брати текст `знайдено N шоурумів` з `/showrooms/map`; для цього є окремий `/showrooms/map/counters`

---

## 9) Приклад запиту

```bash
curl -s "https://jm-showroomer-back.onrender.com/api/v1/showrooms/map?north=54.8&south=47.5&east=24.5&west=13.8&zoom=5"
```

З фільтром по країні:

```bash
curl -s "https://jm-showroomer-back.onrender.com/api/v1/showrooms/map?north=54.8&south=49.0&east=24.5&west=14.0&zoom=6&country=Poland"
```
