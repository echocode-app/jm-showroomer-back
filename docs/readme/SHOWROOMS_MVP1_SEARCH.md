# Showrooms MVP1 Search — Flutter Integration Guide

---

## 1) Endpoint

`GET /showrooms`

Підтримує:
- фільтри
- курсорну пагінацію
- режими пошуку
- рольову видимість

---

## 2) Базові параметри

- `limit` (1..100)
- `cursor` (opaque backend cursor)
- `fields` (`marker|card`)
- `q`
- `qMode` (`name|city`)
- `city`
- `country`
- `brand`
- `type`
- `categories`
- `categoryGroup`
- `subcategories`
- `geohashPrefix`
- `geohashPrefixes`
- `nearLat`
- `nearLng`
- `nearRadiusKm`

---

## 3) Search modes

## 3.1 Default mode
- Використовується коли немає спеціальних search режимів.
- Орієнтований на стабільну стрічку (recency-like ordering).

## 3.2 Name mode
- `qMode=name` + `q`.
- Prefix-style пошук по нормалізованому імені.

## 3.3 City mode
- `qMode=city` + `q` або explicit `city`.
- `city` має пріоритет над `q`.
- Нормалізація міста на бекенді.

## 3.4 Geohash mode
- `geohashPrefix` або `geohashPrefixes`.
- Для multi-prefix режиму backend може вимикати cursor paging (`paging=disabled`).

## 3.5 Nearby mode (approximate)
- `nearLat + nearLng (+ nearRadiusKm)`.
- Backend перетворює nearby params у geohash prefixes (approximate area search).
- Це не distance-sorted search.
- Працюють ті самі map-mode обмеження, що і для `geohashPrefix(es)`.

---

## 4) Visibility rules by role

- Guest/User: тільки `approved`.
- Owner: власні showroom + owner visibility logic.
- Admin: найширший доступ по статусам.

Flutter не повинен припускати однаковий список для різних ролей.

---

## 5) Pagination contract

- Cursor повертається у `meta.nextCursor`.
- Передавати cursor назад потрібно без змін.
- `meta.paging`:
  - `enabled` — є наступна сторінка
  - `end` — кінець
  - `disabled` — курсор недоступний у цьому режимі

---

## 6) Cursor behavior

- Cursor backend-owned, versioned.
- Некоректний cursor -> `CURSOR_INVALID`.
- Якщо `CURSOR_INVALID`, Flutter має:
  1) скинути cursor,
  2) перезапустити fetch з початку.

---

## 7) Geo logic

- Пошук по `geohash` використовує prefix логіку.
- Multi-prefix режим = злиття кількох гілок, cursor може бути вимкнений.
- `geo.cityNormalized` використовується для city filtering.
- У базовому `fields=card` payload точні координати (`geo.coords`) не повертаються.
- Для мапи використовуйте `fields=marker` (мінімальний payload з `geo.coords`).

---

## 8) Index behavior

Firestore composite indexes обов'язкові для частини комбінацій.

Якщо index відсутній/не готовий:
- backend повертає стабільну доменну помилку (`INDEX_NOT_READY` в релевантних flow).
- Flutter має показати retry UX.

---

## 9) Fallback expectations

- Empty result — це валідна відповідь, не помилка.
- Частина фільтрів може відсіювати все (особливо комбіновані search + geo).
- Backend контракт стабільний: `items + meta`.

---

## 10) Practical request examples

## 10.1 Basic listing
```http
GET /showrooms?limit=20
```

## 10.2 Name search
```http
GET /showrooms?q=tot&qMode=name&limit=20
```

## 10.3 City search
```http
GET /showrooms?city=Kyiv&limit=20
```

## 10.4 Geohash single prefix
```http
GET /showrooms?geohashPrefix=u9&limit=20
```

## 10.5 Geohash multi-prefix
```http
GET /showrooms?geohashPrefixes=u9,ua&limit=20
```
(перевіряй `meta.paging`, cursor може бути `null`)

## 10.6 Next page
```http
GET /showrooms?limit=20&cursor=<opaque_cursor>
```

## 10.7 Nearby search (approx)
```http
GET /showrooms?nearLat=50.4501&nearLng=30.5234&nearRadiusKm=5
```

## 10.8 Marker mode (map payload)
```http
GET /showrooms?nearLat=50.4501&nearLng=30.5234&nearRadiusKm=5&fields=marker
```

---

## 11) Flutter implementation checklist

- Зберігати cursor per-query-state (filters+mode).
- При зміні будь-якого фільтра скидати cursor.
- Обробляти `paging=disabled` як non-cursor режим.
- На `CURSOR_INVALID` робити hard reset list state.
- Не будувати cursor локально.

---

## 12) What Flutter must not assume

- Що cursor працює для всіх режимів.
- Що однаковий запит дасть однаковий список для різних ролей.
- Що `q` та `city` комбінуються без змін пріоритету.
- Що index-related помилки = баг API (часто це інфраструктурна готовність).
