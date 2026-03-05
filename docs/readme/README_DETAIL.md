# README_DETAIL (Integration Hub)

Цей файл тепер є індексом інтеграційної документації. Детальні секції винесені у менші технічні документи.

## Швидкі посилання

- `INTEGRATION_API_WORKFLOWS.md` - API-флоу по доменах (auth/users/showrooms/lookbooks/events/admin/collections).
- `INTEGRATION_ERRORS_LIMITS.md` - помилки, обмеження, cursor-поведінка, гарантії ідемпотентності.
- `API_VERSIONING_POLICY.md` - versioning/deprecation policy для стабільної еволюції API.
- `OPERATIONAL_EXPECTATIONS.md` - операційні очікування (retry/timeout/rate-limit/known limitations).
- `CHANGELOG_API.md` - журнал змін API.
- `ANALYTICS_CONTRACT.md` - аналітичний контракт backend/client.
- `SHOWROOMS_MVP1_SEARCH.md` - пошук шоурумів, geo-моди, важливі edge-cases.
- `CURSOR_PAGINATION_FLUTTER.md` - універсальні правила курсорної пагінації.
- `ADMIN_ANALYTICS.md` - read-only admin analytics endpoints.
- `FIRESTORE_REQUIRED_INDEXES.md` - обов'язкові індекси для стабільної роботи списків.
- `POSTMAN_COLLECTION_GUIDE.md` - матриця тестів + запуск Postman collection.
- `archive/README_DETAIL_LEGACY.md` - повний legacy-документ попередньої версії.

## Базовий контракт

- Base path: `/api/v1`
- Формат успіху: `success=true`, `data`, опційно `meta`.
- Формат помилки: `success=false`, `error.code`, `error.message`.
- Public list endpoints підтримують `optionalAuth`; mutating endpoints вимагають `Authorization: Bearer <idToken>`.
- Cursor є opaque і прив'язаний до конкретного режиму запиту (фільтри/порядок/мод пошуку).

## Інтеграційна стратегія для клієнтів

1. Реалізувати `auth/oauth` + `users/me` як перший health-check контракту.
2. Покрити domain flows по одному модулю: showrooms -> lookbooks -> events -> collections.
3. Додати негативні сценарії: `401`, `403`, `400 QUERY_INVALID`, `400 CURSOR_INVALID`.
4. Включити `/analytics/ingest` як best-effort канал, без блокування UX.
5. Перед релізом прогнати Postman regression collection із `postman/` (або дзеркала `docs/postman`).
