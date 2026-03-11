# Flutter Endpoint Checklist MVP1 (Detailed)

## 1) Ціль документа

Дати Flutter-розробнику:

- повний список endpoint-ів проекту;
- що обов'язково інтегрувати в MVP1;
- happy/unhappy флоу по обов'язкових endpoint-ах;
- які помилки обробляти в UI.

Base URL:

- `https://<render-domain>/api/v1`

## 2) Загальні інтеграційні правила

1. У protected endpoint передавати:

- `Authorization: Bearer <Firebase ID token>`.

2. Орієнтуватися на:

- `error.code` (головний сигнал);
- `HTTP status` (другий сигнал).

3. `PATCH /users/profile` має state-aware поведінку:

- до owner registration дозволені тільки `appLanguage` і `notificationsEnabled`;
- після owner registration дозволені також `name`, `position`, `country`, `instagram`;
- при спробі змінити identity-поля до owner registration backend повертає `403 USER_PROFILE_FIELDS_FORBIDDEN`.

4. Cursor pagination:

- не генерувати cursor вручну;
- брати тільки `meta.nextCursor` з попередньої відповіді;
- при зміні фільтра/запиту курсор скидати.

5. Idempotent дії:

- favorite/want-to-visit/dismiss/read можуть викликатися повторно без падіння;
- UI має лишатися консистентним після повторного tap.

6. Notifications type handling (обов'язково):

- Flutter має коректно відображати всі поточні типи:
  - `SHOWROOM_APPROVED`
  - `SHOWROOM_REJECTED`
  - `SHOWROOM_DELETED_BY_ADMIN`
  - `SHOWROOM_FAVORITED`
  - `LOOKBOOK_FAVORITED`
  - `EVENT_WANT_TO_VISIT`
- Для `SHOWROOM_DELETED_BY_ADMIN` показувати, який showroom видалено, та час з `payload.deletedAt` (якщо присутній).
- На цьому етапі причина видалення не передається і не очікується.
- Push-текст від бекенду локалізується за `users.appLanguage` (`uk|en`) з fallback `en`.
- In-app текст нотифікацій у Flutter має бути локалізований локально по `type + payload` (не покладатися тільки на push title/body).

## 3) Матриця endpoint-ів проекту для Flutter

Легенда:

- `MVP1 Required`: обов'язково підключити.
- `MVP1 Optional`: бажано підключити, але не блокує реліз.
- `MVP1 Skip`: не інтегрувати у mobile MVP1.

| Domain      | Method | Endpoint                                        | MVP1 статус   | Примітка                                     |
| ----------- | ------ | ----------------------------------------------- | ------------- | -------------------------------------------- |
| Core        | GET    | `/health`                                       | MVP1 Required | Базова перевірка доступності API             |
| Auth        | POST   | `/auth/oauth`                                   | MVP1 Required | Логін через Firebase token                   |
| Users       | GET    | `/users/me`                                     | MVP1 Required | Bootstrap профілю/ролі                       |
| Users       | DELETE | `/users/me`                                     | MVP1 Optional | Видалення акаунта (не блокер релізу)         |
| Users       | GET    | `/users/me/notifications`                       | MVP1 Required | Список нотифікацій                           |
| Users       | GET    | `/users/me/notifications/unread-count`          | MVP1 Required | Badge/count                                  |
| Users       | PATCH  | `/users/me/notifications/{notificationId}/read` | MVP1 Required | Mark as read                                 |
| Users       | POST   | `/users/me/devices`                             | MVP1 Required | Push-ready реєстрація девайсу                |
| Users       | DELETE | `/users/me/devices/{deviceId}`                  | MVP1 Required | Push-ready видалення девайсу                 |
| Users       | POST   | `/users/complete-onboarding`                    | MVP1 Required | Завершення онбордингу                        |
| Users       | POST   | `/users/complete-owner-profile`                 | MVP1 Required | Upgrade user -> owner                        |
| Users       | PATCH  | `/users/profile`                                | MVP1 Required | Оновлення профілю                            |
| Showrooms   | GET    | `/showrooms`                                    | MVP1 Required | Каталог + пагінація                          |
| Showrooms   | GET    | `/showrooms/suggestions`                        | MVP1 Required | Підказки пошуку                              |
| Showrooms   | GET    | `/showrooms/counters`                           | MVP1 Required | Лічильники фільтрів                          |
| Showrooms   | POST   | `/showrooms/create`                             | MVP1 Required | Owner flow                                   |
| Showrooms   | POST   | `/showrooms/draft`                              | MVP1 Required | Owner flow                                   |
| Showrooms   | GET    | `/showrooms/{id}`                               | MVP1 Required | Деталь showroom                              |
| Showrooms   | GET    | `/showrooms/{id}/share`                         | MVP1 Required | Share payload (url/text/platform targets)    |
| Showrooms   | PATCH  | `/showrooms/{id}`                               | MVP1 Required | Owner flow                                   |
| Showrooms   | DELETE | `/showrooms/{id}`                               | MVP1 Required | Owner flow                                   |
| Showrooms   | POST   | `/showrooms/{id}/submit`                        | MVP1 Required | Owner flow                                   |
| Showrooms   | POST   | `/showrooms/{id}/favorite`                      | MVP1 Required | Favorite toggle                              |
| Showrooms   | DELETE | `/showrooms/{id}/favorite`                      | MVP1 Required | Favorite toggle                              |
| Showrooms   | GET    | `/share/showrooms/{id}`                         | MVP1 Required | Final public share URL (redirect/fallback)   |
| Collections | GET    | `/collections/favorites/showrooms`              | MVP1 Required | Список favorite showrooms                    |
| Collections | POST   | `/collections/favorites/showrooms/sync`         | MVP1 Required | Guest -> auth sync                           |
| Lookbooks   | GET    | `/lookbooks`                                    | MVP1 Required | Каталог lookbooks + nearby (`nearLat`,`nearLng`,`nearRadiusKm`) |
| Lookbooks   | GET    | `/lookbooks/{id}`                               | MVP1 Required | Деталь lookbook                              |
| Lookbooks   | GET    | `/lookbooks/{id}/share`                         | MVP1 Required | Share payload (url/text/platform targets)    |
| Lookbooks   | POST   | `/lookbooks/create`                             | MVP1 Skip     | У mobile MVP1 не створюємо контент           |
| Lookbooks   | POST   | `/lookbooks`                                    | MVP1 Skip     | У mobile MVP1 не створюємо контент           |
| Lookbooks   | PATCH  | `/lookbooks/{id}`                               | MVP1 Skip     | Не потрібен у mobile MVP1                    |
| Lookbooks   | DELETE | `/lookbooks/{id}`                               | MVP1 Skip     | Не потрібен у mobile MVP1                    |
| Lookbooks   | POST   | `/lookbooks/{id}/favorite`                      | MVP1 Required | Favorite toggle                              |
| Lookbooks   | DELETE | `/lookbooks/{id}/favorite`                      | MVP1 Required | Favorite toggle                              |
| Lookbooks   | POST   | `/lookbooks/{id}/rsvp`                          | MVP1 Skip     | Stub endpoint, не бізнес-критично            |
| Lookbooks   | GET    | `/share/lookbooks/{id}`                         | MVP1 Required | Final public share URL (redirect/fallback)   |
| Collections | GET    | `/collections/favorites/lookbooks`              | MVP1 Required | Список favorite lookbooks                    |
| Collections | POST   | `/collections/favorites/lookbooks/sync`         | MVP1 Required | Guest -> auth sync                           |
| Events      | GET    | `/events`                                       | MVP1 Required | Каталог events                               |
| Events      | GET    | `/events/{id}`                                  | MVP1 Required | Деталь event                                 |
| Events      | GET    | `/events/{id}/share`                            | MVP1 Required | Share payload (url/text/platform targets)    |
| Events      | POST   | `/events/{id}/want-to-visit`                    | MVP1 Required | State toggle                                 |
| Events      | DELETE | `/events/{id}/want-to-visit`                    | MVP1 Required | State toggle                                 |
| Events      | POST   | `/events/{id}/dismiss`                          | MVP1 Required | State toggle                                 |
| Events      | DELETE | `/events/{id}/dismiss`                          | MVP1 Required | State toggle                                 |
| Events      | POST   | `/events/{id}/rsvp`                             | MVP1 Skip     | У MVP1 повертає `501 EVENTS_WRITE_MVP2_ONLY` |
| Events      | GET    | `/share/events/{id}`                            | MVP1 Required | Final public share URL (redirect/fallback)   |
| Collections | GET    | `/collections/want-to-visit/events`             | MVP1 Required | Список want-to-visit                         |
| Collections | POST   | `/collections/want-to-visit/events/sync`        | MVP1 Required | Guest -> auth sync                           |
| Analytics   | POST   | `/analytics/ingest`                             | MVP1 Required | Клієнтські аналітичні події                  |
| Admin       | GET    | `/admin/overview`                               | MVP1 Skip     | Для admin panel                              |
| Admin       | GET    | `/admin/analytics/showrooms`                    | MVP1 Skip     | Для admin panel                              |
| Admin       | GET    | `/admin/analytics/events`                       | MVP1 Skip     | Для admin panel                              |
| Admin       | GET    | `/admin/analytics/platform`                     | MVP1 Skip     | Для admin panel                              |
| Admin       | GET    | `/admin/analytics/users-onboarding`             | MVP1 Skip     | Для admin panel (onboarding funnel/progress) |
| Admin       | GET    | `/admin/showrooms`                              | MVP1 Skip     | Для admin panel                              |
| Admin       | GET    | `/admin/showrooms/{id}`                         | MVP1 Skip     | Для admin panel                              |
| Admin       | GET    | `/admin/showrooms/{id}/history`                 | MVP1 Skip     | Для admin panel                              |
| Admin       | GET    | `/admin/showrooms/{id}/stats`                   | MVP1 Skip     | Для admin panel                              |
| Admin       | POST   | `/admin/showrooms/{id}/approve`                 | MVP1 Skip     | Для admin panel                              |
| Admin       | POST   | `/admin/showrooms/{id}/reject`                  | MVP1 Skip     | Для admin panel                              |
| Admin       | DELETE | `/admin/showrooms/{id}`                         | MVP1 Skip     | Для admin panel                              |

## 4) Happy/Unhappy flows для обов'язкових endpoint-ів

## 4.1 Auth bootstrap

1. Happy:

- `POST /auth/oauth` з валідним idToken -> `200`;
- зберегти користувача і роль;
- викликати `GET /users/me` для актуального профілю.

2. Unhappy:

- без `idToken` -> `400 ID_TOKEN_REQUIRED`;
- невалідний/протухлий токен -> `401`.

## 4.2 Showrooms list/detail/favorite

1. Happy:

- `GET /showrooms?limit=20` -> список + `meta.nextCursor`;
- `GET /showrooms/{id}` -> деталь;
- `POST /showrooms/{id}/favorite` -> `200`;
- `DELETE /showrooms/{id}/favorite` -> `200`.

2. Unhappy:

- `cursor` невалідний -> `400 CURSOR_INVALID`;
- favorite без auth -> `401`;
- favorite для недоступного showroom -> `404 SHOWROOM_NOT_FOUND`;
- submit/update у неправильному статусі -> `400 SHOWROOM_NOT_EDITABLE` або `409 SHOWROOM_LOCKED_PENDING`.
- `type` або `availability` поза enum -> `400 VALIDATION_ERROR`;
- `geo.city` + `geo.coords` є canonical для owner flow; backend сам дзеркалить їх у compatibility-поля `city` і `location`.

## 4.2.1 Showroom share (обов'язково)

1. Happy:

- для тапу на "Share" викликати `GET /showrooms/{id}/share?platform=auto`;
- з відповіді брати `data.share.shareUrl` як головний URL для native share sheet;
- текст:
  - мінімум: використовувати `data.share.recommendedText`;
  - або локалізувати власний текст Flutter і додати `shareUrl`.

2. Unhappy:

- `404 SHOWROOM_NOT_FOUND` -> showroom недоступний для публічного share (видалений/не approved);
  також сюди входить blocked-country showroom;
- `400 QUERY_INVALID` -> помилка параметра `platform`.

3. Платформна поведінка (must-have):

- Flutter не повинен вручну підставляти App Store/Play URL у share payload;
- backend повертає fallback targets (`targets.ios/android`);
- якщо юзер відкрив `shareUrl`:
  - app встановлено + налаштовані universal/app links -> система відкриває app;
  - без такого OS-level налаштування backend може тільки редіректити на App Store / Play Store через `GET /share/showrooms/{id}`.

## 4.3 Lookbooks list/detail/favorite

1. Happy:

- `GET /lookbooks?country=Ukraine&seasonKey=summer` -> `200`;
- `GET /lookbooks?country=Ukraine&nearLat=50&nearLng=30&nearRadiusKm=5` -> `200`;
- `GET /lookbooks/{id}` -> `200`;
- favorite/unfavorite -> `200`.

Ready-to-use запити для Flutter кнопки "Шукати поблизу мене":
- `GET {{baseUrl}}/lookbooks?country=Ukraine&nearLat=50&nearLng=30&nearRadiusKm=5`
- `GET {{baseUrl}}/lookbooks?country=Ukraine&seasonKey=summer&nearLat=50&nearLng=30&nearRadiusKm=5`

2. Unhappy:

- невалідний cursor -> `400 CURSOR_INVALID`;
- відсутні/невалідні query-параметри -> `400` (`QUERY_INVALID`/`VALIDATION_ERROR`);
- lookbook не знайдено -> `404 LOOKBOOK_NOT_FOUND`;
  також сюди входить blocked-country lookbook;
- без auth на favorite -> `401`.

## 4.3.1 Lookbook share (обов'язково)

1. Happy:

- для тапу на "Share" викликати `GET /lookbooks/{id}/share?platform=auto`;
- з відповіді брати `data.share.shareUrl` як головний URL для native share sheet;
- текст:
  - мінімум: використовувати `data.share.recommendedText`;
  - або локалізувати власний текст Flutter і додати `shareUrl`.

2. Unhappy:

- `404 LOOKBOOK_NOT_FOUND` -> lookbook недоступний для публічного share (видалений/не published);
  також сюди входить blocked-country lookbook;
- `400 QUERY_INVALID` -> помилка параметра `platform`.

3. Платформна поведінка:

- backend повертає fallback targets (`targets.ios/android`);
- фінальне відкриття app по HTTPS-share-link потребує `universal links / app links`;
- без OS-level налаштування backend може тільки редіректити на App Store / Play Store через `GET /share/lookbooks/{id}`.

## 4.4 Events list/detail/state

1. Happy:

- `GET /events` -> `200`;
- `GET /events/{id}` -> `200`;
- want-to-visit/dismiss toggle -> `200`.

2. Unhappy:

- невалідний cursor -> `400 CURSOR_INVALID`;
- неіснуючий event -> `404 EVENT_NOT_FOUND`;
- `POST /events/{id}/rsvp` у MVP1 -> `501 EVENTS_WRITE_MVP2_ONLY`.

## 4.4.1 Event share (обов'язково)

1. Happy:

- для тапу на "Share" викликати `GET /events/{id}/share?platform=auto`;
- з відповіді брати `data.share.shareUrl` як головний URL для native share sheet;
- текст:
  - мінімум: використовувати `data.share.recommendedText`;
  - або локалізувати власний текст Flutter і додати `shareUrl`.

2. Unhappy:

- `404 EVENT_NOT_FOUND` -> event недоступний для публічного share (видалений/не published);
  також сюди входить blocked-country event;
- `400 QUERY_INVALID` -> помилка параметра `platform`.

3. Платформна поведінка:

- backend повертає fallback targets (`targets.ios/android`);
- фінальне відкриття app по HTTPS-share-link потребує `universal links / app links`;
- без OS-level налаштування backend може тільки редіректити на App Store / Play Store через `GET /share/events/{id}`.

## 4.5 Collections sync (guest -> auth)

1. Happy:

- після логіну викликати 3 sync endpoint-и;
- відповідь містить `applied` і `skipped`;
- повторний sync не дублює стан.

2. Unhappy:

- перевищено ліміт ids -> `400 EVENT_SYNC_LIMIT_EXCEEDED` / `LOOKBOOK_SYNC_LIMIT_EXCEEDED` / `SHOWROOM_SYNC_LIMIT_EXCEEDED`.

## 4.6 Notifications

1. Happy:

- список, unread-count, mark-as-read працюють;
- mark-as-read повторно не ламає стан.

2. Unhappy:

- без auth -> `401`;
- чужий або неіснуючий `notificationId` -> `404 NOTIFICATION_NOT_FOUND`.

## 4.7 Devices

1. Happy:

- register/upsert device -> `200`;
- delete device -> `200`.

2. Unhappy:

- без auth -> `401`;
- невалідний payload -> `400 VALIDATION_ERROR`.

## 4.8 Analytics ingest

1. Happy:

- валідний батч подій -> `200`, `accepted/stored/failed`.

MVP1 client events, які Flutter має відправляти:
- `app_opened`
- `session_started`
- `splash_view`
- `onboarding_step_view` (передавати `context.step=1..4`)
- `onboarding_step_completed` (передавати `context.step=1..4`)
- `continue_as_guest`
- `auth_started`
- `owner_registration_view`
- `owner_registration_submitted`
- `screen_view`
- `search_executed`
- `filter_applied`

Важливо:
- `onboarding_completed` і `owner_registration_completed` зараз емітяться бекендом (Flutter їх не дублює).
- Події поза whitelist будуть відхилені з `400 EVENT_NAME_INVALID`.

2. Unhappy:

- невалідна структура або eventName -> `400` (наприклад `EVENT_NAME_INVALID`);
- ліміт частоти -> `429`.

## 5) Єдина мапа помилок для Flutter UI

1. `400`:

- показати повідомлення про некоректні дані;
- не робити автоматичний retry.

2. `401`:

- оновити/перезапросити токен;
- якщо не вийшло, розлогін і перенаправлення на auth.

3. `403`:

- показати "Недостатньо прав".

4. `404`:

- показати "Контент не знайдено або вже недоступний".

5. `409`:

- показати бізнес-конфлікт (наприклад showroom locked/recreate cooldown).

6. `429`:

- короткий backoff retry (наприклад 1s, 2s, 4s).

7. `500/503`:

- загальний fallback екран + кнопка retry;
- для `INDEX_NOT_READY` показати нейтральний текст "тимчасово недоступно".

## 6) Checklist інтеграції для Flutter-dev

1. Підключені всі `MVP1 Required` endpoint-и з розділу 3.
2. Реалізований єдиний error-handler по `error.code`.
3. Реалізована cursor pagination без ручної генерації cursor.
4. Реалізовані idempotent toggle-стани (favorite/want-to-visit/dismiss/read).
5. Реалізований guest->auth sync одразу після логіну.
6. Підключений analytics ingest + відправляються всі MVP1 client events з п.4.8.
7. Для `POST /events/{id}/rsvp` є захист (не викликати у MVP1).
8. Пройдено smoke вручну: auth, списки, деталі, тумблери, notifications, sync.

## 7) Мінімальний smoke-прохід Flutter після інтеграції

1. Логін (`/auth/oauth`) -> профіль (`/users/me`).
2. Showrooms list + detail + favorite.
3. Lookbooks list + detail + favorite.
4. Events list + detail + want-to-visit + dismiss.
5. Notifications list + unread-count + read.
6. Guest->auth sync 3 колекцій.
7. Device register/remove.
8. Analytics ingest одного батчу.
