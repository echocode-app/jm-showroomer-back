# Cursor Pagination (Flutter Integration Guide, UA)

## Що таке cursor і навіщо бекенд його використовує

У багатьох list endpoint-ах цього бекенду використовується **cursor pagination**, а не page/offset.

Чому:
- стабільна пагінація, коли під час скролу з’являються нові записи
- без дублікатів між сторінками
- без пропусків, коли кілька записів мають однаковий timestamp сортування
- нативно підходить для Firestore (`startAfter(...)`)

## Головне правило для Flutter (працює всюди)

Сприймайте `cursor` як **opaque backend token**:
- не парсити
- не змінювати
- не генерувати на клієнті
- передавати назад рівно той `meta.nextCursor`, який прийшов у відповіді

## Універсальний client flow (для всіх cursor-based endpoint-ів)

### 1) Перша сторінка

Запит без `cursor`.

### 2) Зчитати `meta` з відповіді

Використовуйте:
- `meta.nextCursor`
- `meta.hasMore`
- `meta.paging` (якщо endpoint його повертає)

### 3) Наступна сторінка

Якщо:
- `hasMore == true`
- `nextCursor != null`

Тоді відправляйте той самий запит **з тим самим набором фільтрів**, плюс:

`cursor=<meta.nextCursor>`

## Важливий інваріант: фільтри мають залишатися тими самими

Cursor прив’язаний до активного query/filter/order на бекенді.

Якщо користувач змінює будь-який фільтр (приклади):
- `status`
- `country`
- `city`
- search query
- sort mode / search mode

Flutter має:
1. скинути поточний cursor
2. очистити завантажений список (або створити новий state списку)
3. заново запитати першу сторінку (без cursor)

## Обробка помилок (загально)

### `CURSOR_INVALID`

Означає, що cursor:
- невалідний за форматом
- застарілий для поточного режиму
- не підходить для цього endpoint-а

Що робити у Flutter:
1. скинути cursor
2. перезавантажити першу сторінку

### `QUERY_INVALID`

Означає, що параметри запиту невалідні (включно з відсутнім required filter у деяких endpoint-ах).

Що робити у Flutter:
- виправити параметри запиту
- не робити blind retry з тим самим невалідним query

## Endpoint-specific notes (для цього проєкту)

### Public showrooms list (`GET /showrooms`)

- Cursor backend-owned і залежить від режиму list/search
- У деяких map режимах backend може повернути `paging=disabled`
- Джерело істини для пагінації: `meta.paging` + `meta.nextCursor`

Якщо `paging=disabled`:
- не намагатися вантажити наступну сторінку через cursor

### Admin pending moderation queue (`GET /admin/showrooms?status=pending`)

- Потрібен явний `status=pending`
- Використовується детермінований порядок черги (submitted time + tie-breaker)
- Використовується окремий moderation cursor (не перевикористовувати з іншими admin list filters)

Якщо admin filter змінюється або `status` більше не `pending`:
- скинути cursor і почати з першої сторінки

### Lookbooks / Events / Notifications

Ці endpoint-и також використовують backend-generated cursor tokens.
Ті самі правила:
- opaque token
- той самий набір фільтрів для continuation
- reset при зміні фільтрів
- при `CURSOR_INVALID` починати з page 1

## Мінімальна модель state у Flutter (recommended)

Для кожного paginated screen зберігайте:
- `items`
- `nextCursor`
- `hasMore`
- `isLoadingFirstPage`
- `isLoadingNextPage`
- `activeQueryKey` (serialized current filters)

Коли `activeQueryKey` змінюється:
- reset `items`, `nextCursor`, `hasMore`

## Швидкі anti-patterns (чого уникати)

- Перевикористання cursor між різними tabs/filters
- Декодування cursor на клієнті, щоб дивитись timestamps
- Відправка старого cursor після зміни search/filter
- Припущення, що формат cursor однаковий для всіх endpoint-ів
