# API Versioning and Deprecation Policy

## 1) Поточна версія

- Базовий шлях API: `/api/v1`
- Поточна контрактна версія OpenAPI: `1.0.0`
- Модель сумісності: `backward-compatible by default` у межах `v1`

## 2) Що вважається breaking change

Breaking для `v1`:
- видалення endpoint-а або HTTP-методу;
- зміна типу/семантики обов'язкового поля;
- зміна стабільного `error.code` для існуючого сценарію;
- зміна auth/role-вимог без перехідного періоду;
- несумісна зміна курсора або пагінаційної семантики.

Такі зміни допускаються тільки через нову major-версію (`/api/v2`).

## 3) Що допускається в minor рамках `v1`

- додавання нових endpoint-ів;
- додавання нових optional полів у відповіді;
- додавання нових optional query-параметрів;
- розширення enum-ів для не-критичних полів (з fallback поведінкою клієнта);
- нові `error.code` для нових сценаріїв.

## 4) Deprecation policy

- Deprecated endpoint/поле маркується в OpenAPI через `deprecated: true`.
- Мінімальний період підтримки після депрекейту: 90 днів.
- Для deprecated сценаріїв обов'язково дається migration path у `description`/`externalDocs`.
- Після завершення періоду підтримки removal виконується тільки в новій major-версії.

## 5) Release discipline

При кожній зміні API:
1. Оновити `docs/*.yaml` і `docs/openapi.yaml`.
2. Оновити технічні readme (`INTEGRATION_API_WORKFLOWS`, `INTEGRATION_ERRORS_LIMITS`).
3. Оновити Postman collection і прогнати regression вручну.
4. Зафіксувати зміни в `docs/readme/CHANGELOG_API.md`.
