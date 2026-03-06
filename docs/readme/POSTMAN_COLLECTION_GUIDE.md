# Postman Collection Guide

## Де брати файли в репо

Canonical файли (для режиму **Connect Local Repo**):
- `postman/collections/JM Showroomer - All Scenarios.postman_collection.json`
- `postman/environments/JM_Showroomer_Environment__Template__Copy.postman_environment.json`

Дзеркальна копія для docs:
- `docs/postman/JM_Showroomer_All_Scenarios.postman_collection.json`
- `docs/postman/JM_Showroomer_Environment.template.json`

## Швидкий старт (без ручного складання запитів)

1. Відкрий Postman, підключи локальний репозиторій.
2. В Collections відкрий `JM Showroomer - All Scenarios`.
3. В Environments створи копію template environment.
4. Заповни тільки обов'язкові змінні:
   - `baseUrl` (наприклад `https://jm-showroomer-back.onrender.com/api/v1`)
   - `idToken_user`
   - `idToken_owner`
   - `idToken_admin`
5. Обери цей Environment у правому верхньому куті.
6. Запусти collection runner для всієї колекції або по папках `00` → `08`.

## Які змінні заповнюються автоматично

Колекція сама проставляє:
- `auth_user`
- `auth_owner`
- `auth_admin`
- `showroom_id`
- `lookbook_id`
- `event_id`
- `notification_id`
- `next_cursor`

## Важливо про токени

- `auth_*` не треба вводити вручну.
- У smoke OAuth-запитах `auth_*` формується автоматично як `Bearer {{idToken_*}}`.
- У `PATCH /users/profile` pre-owner сценарій перевіряє тільки `appLanguage` і `notificationsEnabled`.
- Identity-поля (`name`, `country`, `position`, `instagram`) потрібно тестувати вже owner-токеном або після `POST /users/complete-owner-profile`.

## Інтерпретація 4xx/5xx у regression

- Частина `4xx` в папці `08 Negative + Security` є очікуваною (це контрактні негативні сценарії).
- `404` у сценаріях з `{{lookbook_id}}` або `{{showroom_id}}` означає, що перед цим не з'явився тестовий ресурс (перевірити попередні кроки owner/admin flow).
- `503 INDEX_NOT_READY` означає проблему/затримку Firestore composite index, а не Postman-налаштування.

## Strict green прогін

- Колекція налаштована так, щоб очікувані негативні сценарії проходили як `Passed`, а не `Error`.
- Для id-залежних кроків (ресурс ще не створений/не знайдений) `404` є контрактно-допустимим у тестах.
- Для `lookbooks/create` можливий `400`, якщо немає валідного `showroom_id`; цей випадок також оброблено тестом як контрольований контрактний результат.

## CI прогін проти staging (Newman)

У `CI` workflow доданий job `postman-staging-contract`, який запускає collection автоматично.

Потрібні GitHub Secrets:
- `TEST_USER_TOKEN`
- `TEST_ADMIN_TOKEN`

Логіка запуску:
- base URL береться у такому пріоритеті:
  1) `workflow_dispatch` input `staging_base_url`,
  2) `STAGING_BASE_URL` secret (якщо існує),
  3) fallback `https://jm-showroomer-back.onrender.com/api/v1`.
- `idToken_owner` у CI дорівнює `TEST_USER_TOKEN`.
- якщо токенів немає -> job пропускається.
