# Postman Assets (Canonical)

Ця директорія є canonical джерелом Postman артефактів для локального repo-mode.

## Файли

- `collections/JM Showroomer - All Scenarios.postman_collection.json`
- `environments/JM_Showroomer_Environment__Template__Copy.postman_environment.json`

## Швидкий запуск

1. Підключи репозиторій у Postman (`Connect Local Repo`).
2. Обери колекцію `JM Showroomer - All Scenarios`.
3. Створи environment на базі template.
4. Заповни:
   - `baseUrl`
   - `idToken_user`
   - `idToken_owner`
   - `idToken_admin`
5. Запусти runner по папках `00` -> `08`.

`auth_user/auth_owner/auth_admin` заповнюються автоматично pre-request скриптом колекції.

## Синхронізація з docs

Після змін у `postman/` обов'язково синхронізуй дзеркальні файли в `docs/postman/`.
