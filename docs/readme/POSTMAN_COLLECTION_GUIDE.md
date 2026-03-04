# Postman Collection Guide

## Файли

- `docs/postman/JM_Showroomer_All_Scenarios.postman_collection.json`
- `docs/postman/JM_Showroomer_Environment.template.json`

## 1) Environment змінні

Обов'язкові:
- `baseUrl` (`http://localhost:3005/api/v1` або stage/prod URL)
- `idToken_user`
- `idToken_owner`
- `idToken_admin`

Автоматично заповнюються тестами колекції:
- `auth_user`
- `auth_owner`
- `auth_admin`
- `showroom_id`
- `lookbook_id`
- `event_id`
- `notification_id`
- `next_cursor`

## 2) Покриття сценаріїв

Колекція покриває:
- smoke + availability
- auth/users/profile/devices/notifications
- showroom owner/admin lifecycle
- lookbooks/events flows
- collections sync
- analytics ingest
- security/negative checks (`401/403/400/404/409/501`)
- idempotency checks для favorite/want-to-visit/dismiss/read

## 3) Порядок запуску

1. Імпортуй environment template і collection.
2. Простав `baseUrl` + три токени.
3. Запусти колекцію folder-by-folder у порядку нумерації.
4. Для повного regression запусти Collection Runner на всю колекцію.

## 4) Інтерпретація результату

- Якщо падає `00 Smoke` - детальний regression не продовжувати.
- Якщо падають тільки negative-перевірки - перевір контракт помилок (`error.code`).
- Якщо падають сценарії з idempotency - це blocker для клієнтського UX.

## 5) CI прогін проти staging (Newman)

У `CI` workflow доданий job `postman-staging-contract`, який запускає collection автоматично.

Потрібні GitHub Secrets:
- `TEST_USER_TOKEN`
- `TEST_ADMIN_TOKEN`

Логіка запуску:
- base URL береться у такому пріоритеті:
  1) `workflow_dispatch` input `staging_base_url`,
  2) `STAGING_BASE_URL` secret (якщо існує),
  3) fallback `https://jm-showroomer-back.onrender.com/api/v1`.
- `idToken_owner` у CI дорівнює `TEST_USER_TOKEN` (owner роль формується в сценаріях колекції).
- якщо токенів немає -> job пропускається (щоб не ламати PR з fork/без доступу до секретів).
