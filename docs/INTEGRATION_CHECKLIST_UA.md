# Integration Checklist UA

Технічний checklist для перевірки коректної інтеграції клієнтів з API.
Swagger залишається джерелом істини для схеми endpoint-ів, параметрів та envelope.

## 1. Загальні принципи інтеграції

- Protected endpoint-и викликаються тільки з `Authorization: Bearer <Firebase ID token>`.
- Основний сигнал для обробки помилки: `error.code`.
- `HTTP status` використовується як другий рівень перевірки.
- Cursor pagination повністю керується бекендом:
  - cursor не генерується вручну;
  - використовується тільки `meta.nextCursor`;
  - при зміні фільтра/режиму курсор скидається.
- Idempotent дії можна викликати повторно без дублювання стану:
  - favorites;
  - want-to-visit;
  - dismiss;
  - mark-as-read.
- Aggregation endpoint-и не замінюють list endpoint-и:
  - `/showrooms/counters` повертає тільки агреговані значення;
  - `/admin/analytics/*` повертають read-only аналітику, не список сутностей.
- Projection / fields обмежують набір полів у відповіді:
  - клієнт не повинен очікувати поле, якщо воно не запитане через `fields`;
  - при використанні `fields` UI має будуватись тільки на реально запитаних полях.
- Error handling expectation:
  - `4xx` для очікуваних бізнес- і валідаційних помилок;
  - `5xx` завжди розглядаються як інфраструктурна або серверна проблема;
  - `503 INDEX_NOT_READY` у production не є нормальним станом.

Checklist:

- [ ] Firebase ID token передається тільки в Bearer-форматі
- [ ] `error.code` використовується як основне джерело логіки помилки
- [ ] Cursor не будується і не модифікується на клієнті
- [ ] Aggregation endpoint-и не використовуються як list endpoint-и
- [ ] При `fields` UI не очікує поля, які не були запитані
- [ ] Повторні idempotent виклики не ламають локальний стан

## 2. Аутентифікація

Базовий endpoint:

- `POST /auth/oauth`

Призначення:

- валідація Firebase ID token;
- логін або створення backend profile;
- повернення актуального профілю користувача.

Критичні правила:

- без `idToken` очікується `400 ID_TOKEN_REQUIRED`;
- malformed body не повинен давати `500`, очікувано `400 VALIDATION_ERROR`;
- невалідний або протухлий token -> `401 AUTH_INVALID`;
- після успішного логіну клієнт зберігає auth state і викликає `GET /users/me`.

Checklist:

- [ ] Firebase ID token передається у правильному форматі
- [ ] Токен верифікується на бекенді через `POST /auth/oauth`
- [ ] Після login повертається коректний user object
- [ ] Після login клієнт викликає `GET /users/me`
- [ ] Роль owner не очікується до виклику `POST /users/complete-owner-profile`
- [ ] Якщо роль змінилася після owner flow, UI перечитує актуальний профіль

Примітка:

У наявній логіці роль не змінюється "сама". Перехід у `owner` відбувається тільки через explicit endpoint `POST /users/complete-owner-profile`.

## 3. Онбординг

Endpoint-и:

- `POST /users/complete-onboarding`
- `POST /users/complete-owner-profile`

Правильний порядок:

1. Користувач проходить auth.
2. Після завершення onboarding форми викликається `POST /users/complete-onboarding`.
3. Якщо користувач переходить у owner flow, після заповнення owner-форми викликається `POST /users/complete-owner-profile`.
4. Після успішного owner flow UI перечитує профіль або оновлює локальний state на основі відповіді.

Критичні правила:

- `complete-onboarding` не замінює `complete-owner-profile`;
- `complete-owner-profile` є окремим endpoint-ом для upgrade у роль `owner`;
- blocked-country policy застосовується на бекенді;
- роль `owner` не змінюється без прямого submit owner-форми.

Checklist:

- [ ] `POST /users/complete-onboarding` викликається після завершення onboarding форми
- [ ] `POST /users/complete-owner-profile` викликається тільки після submit owner-форми
- [ ] Після onboarding статус/стан користувача оновлюється в UI
- [ ] Після owner registration роль owner реально застосована
- [ ] UI не робить припущення про owner-role без відповіді бекенду
- [ ] blocked-country кейси перевірені негативними тестами

## 4. Showrooms

Основні endpoint-и:

- `GET /showrooms`
- `GET /showrooms/suggestions`
- `GET /showrooms/counters`
- `GET /showrooms/{id}`
- `POST /showrooms/create`
- `POST /showrooms/draft`
- `PATCH /showrooms/{id}`
- `POST /showrooms/{id}/submit`
- `GET /showrooms/{id}/share`
- `GET /share/showrooms/{id}`

Ключові інтеграційні правила:

- `/showrooms` використовується для списку і мапи;
- `/showrooms/suggestions` використовується тільки для autocomplete / suggestions;
- `/showrooms/counters` використовується тільки для агрегованої статистики;
- `fields` обмежує набір полів у відповіді;
- `country` не можна очікувати в response, якщо воно не входить у запитаний projection;
- pagination йде тільки через backend cursor;
- owner flow не завершений без submit на модерацію;
- pending showroom має contract-level lock на edit.
- `geo.city` + `geo.coords` є canonical для owner flow; backend сам синхронізує compatibility-поля `city` і `location`.
- `type` та `availability` валідовуються бекендом строго по контрактних enum.

Checklist:

- [ ] Якщо використовується `fields`, усі необхідні поля явно вказані
- [ ] `country` не очікується в UI, якщо воно не було додано у `fields`
- [ ] `/showrooms/counters` використовується тільки для агрегованої статистики
- [ ] `/showrooms/suggestions` не використовується як список showroom-ів
- [ ] Для мапи країна/місто/coords беруться з showroom data, а не з окремого marker endpoint
- [ ] Cursor pagination по showroom list працює тільки через `meta.nextCursor`
- [ ] draft -> update -> submit -> approve/reject флоу перевірений повністю
- [ ] `409 SHOWROOM_LOCKED_PENDING` коректно обробляється в UI
- [ ] share showroom використовує `GET /showrooms/{id}/share`, а не ручну побудову URL на клієнті

## 5. Favorites / Want-to-Visit

Основні endpoint-и:

- `POST /showrooms/{id}/favorite`
- `DELETE /showrooms/{id}/favorite`
- `POST /lookbooks/{id}/favorite`
- `DELETE /lookbooks/{id}/favorite`
- `POST /events/{id}/want-to-visit`
- `DELETE /events/{id}/want-to-visit`
- `GET /collections/favorites/showrooms`
- `POST /collections/favorites/showrooms/sync`
- `GET /collections/favorites/lookbooks`
- `POST /collections/favorites/lookbooks/sync`
- `GET /collections/want-to-visit/events`
- `POST /collections/want-to-visit/events/sync`

Ключові правила:

- локальний guest state дозволений тільки як тимчасовий;
- після логіну guest state має бути синхронізований через sync endpoint-и;
- idempotent endpoint-и не мають створювати дублікати;
- колекції читаються окремими collection endpoint-ами, а не з admin analytics.

Checklist:

- [ ] `POST /showrooms/{id}/favorite` інтегрований як idempotent toggle
- [ ] `POST /events/{id}/want-to-visit` інтегрований як idempotent toggle
- [ ] Стан синхронізується після логіну через sync endpoint-и
- [ ] Локальна логіка не залишається єдиним джерелом істини після auth
- [ ] UI коректно переживає повторні tap-и на ті самі дії
- [ ] Collections endpoint-и використовуються для списків user state, а не list endpoint-и з ручною агрегацією

## 6. Events

Основні endpoint-и:

- `GET /events`
- `GET /events/{id}`
- `POST /events/{id}/want-to-visit`
- `DELETE /events/{id}/want-to-visit`
- `POST /events/{id}/dismiss`
- `DELETE /events/{id}/dismiss`
- `GET /events/{id}/share`
- `GET /share/events/{id}`

Ключові правила:

- `/events` повертає тільки upcoming published events;
- past events не повинні очікуватися у list endpoint;
- `/events/{id}` може відкривати event detail напряму;
- `POST /events/{id}/rsvp` у MVP1 не є робочим write flow, очікувано повертає `501 EVENTS_WRITE_MVP2_ONLY`;
- admin analytics не замінює user-facing event list/state endpoints.

Checklist:

- [ ] Want-to-visit коректно оновлює стан UI
- [ ] Dismiss коректно прибирає event зі списку для authenticated user
- [ ] Past events не очікуються у `GET /events`
- [ ] `POST /events/{id}/rsvp` не використовується як MVP1 бізнес-критичний flow
- [ ] Не виконується фронт-агрегація analytics там, де вже існує серверна аналітика
- [ ] Share event використовує `GET /events/{id}/share`, а не ручну побудову URL

## 7. Admin

Основні endpoint-и:

- `GET /admin/showrooms`
- `GET /admin/showrooms/{id}`
- `GET /admin/showrooms/{id}/history`
- `GET /admin/showrooms/{id}/stats`
- `POST /admin/showrooms/{id}/approve`
- `POST /admin/showrooms/{id}/reject`
- `DELETE /admin/showrooms/{id}`
- `GET /admin/analytics/showrooms`
- `GET /admin/analytics/events`
- `GET /admin/analytics/platform`
- `GET /admin/analytics/users-onboarding`

Ключові правила:

- admin analytics endpoint-и є read-only;
- якщо існує серверна агрегація, фронт не повинен рахувати ті самі метрики самостійно;
- admin endpoints вимагають роль `admin`;
- cursor і limit для admin/list analytics мають використовуватись як backend-owned механізми.

Checklist:

- [ ] Для аналітики використовуються саме `/admin/analytics/*`
- [ ] Не виконується фронт-агрегація там, де вже є серверна
- [ ] Pagination для admin list / analytics працює через backend meta
- [ ] approve / reject викликаються тільки через admin endpoints
- [ ] Admin UI не використовує user-facing list endpoint-и як substitute для moderation

## 8. Типові помилки інтеграції

1. Projection обмежує поля  
   Якщо клієнт викликає endpoint з `fields`, відповідь містить тільки запитані поля.  
   Не можна вважати, що `country`, `city`, `contacts` або інші поля завжди повернуться автоматично.

2. Counters не повертає список  
   `/showrooms/counters` повертає агреговані значення.  
   Не можна будувати showroom list із counters response.

3. Analytics endpoint не є list endpoint  
   `/admin/analytics/*` повертає аналітичні агрегації.  
   Ці endpoint-и не повинні використовуватись для побудови користувацьких списків.

4. Owner role не змінюється без explicit endpoint  
   Успішний auth не означає перехід у `owner`.  
   Роль оновлюється тільки після `POST /users/complete-owner-profile`.

5. Guest state без sync не є фінальною інтеграцією  
   Favorites / want-to-visit для гостя мають бути синхронізовані після логіну.  
   Локальна логіка без sync не покриває повний контракт.

6. Cursor не переноситься між різними режимами  
   Не можна використовувати cursor з одного набору фільтрів або endpoint-а в іншому запиті.

7. Share URL не будується на клієнті вручну  
   Для share використовуються тільки backend share payload endpoint-и.  
   Flutter не підміняє share URL на App Store / Play Store URL вручну.

## 9. Acceptance Criteria

Інтеграція вважається завершеною лише якщо:

- [ ] Всі endpoint-и викликаються у правильному порядку в рамках бізнес-флоу
- [ ] Перевірені edge cases для auth, onboarding, owner flow, favorites, dismiss, share
- [ ] Перевірені негативні сценарії по `400/401/403/404/409/429/501`
- [ ] Не залишилось фронтових припущень, які суперечать backend контракту
- [ ] Projection / pagination / sync / aggregation використані коректно
- [ ] Пройдено end-to-end перевірку ключових флоу на реальному середовищі
