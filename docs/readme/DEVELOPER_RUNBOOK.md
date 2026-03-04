# Developer Runbook

Технічний runbook для нових і поточних розробників backend.

## 1) Локальний старт

```bash
npm install
npm run dev
```

Swagger UI:
- `http://localhost:3005/docs`

## 2) Мінімальний quality-gate перед commit

```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:push
```

## 3) Розширена перевірка перед PR

```bash
npm run test:flows
npm run test:notifications
npm run test:full
```

## 4) Корисні maintenance-команди

```bash
npm run test:cleanup:dry
npm run test:cleanup
npm run seed:mocks -- --prefix=mvp1_local_seed
npm run cleanup:mocks:dry -- --prefix=mvp1_local_seed
npm run cleanup:mocks -- --prefix=mvp1_local_seed
```

## 5) Ключові env-прапори

- `NODE_ENV`: `dev|test|prod`
- `PORT`
- `BASE_URL`
- `PUSH_ENABLED`
- `MVP_MODE`
- Firebase credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`)

## 5.1 CI secrets для staging Postman contract

- `TEST_USER_TOKEN`
- `TEST_ADMIN_TOKEN`
- (опційно) `STAGING_BASE_URL`, якщо потрібен override дефолтного staging URL

## 6) Зони відповідальності по коду

- `src/routes` - HTTP surface.
- `src/controllers` - orchestration/HTTP layer.
- `src/services` - доменна логіка + Firestore IO.
- `src/schemas` - Joi валідація.
- `src/middlewares` - auth/role/validation/rate-limit/error.
- `docs/` - OpenAPI та інтеграційні контракти.

## 7) Коли змінюєш API

1. Онови відповідний `docs/*.yaml` і, за потреби, `docs/openapi.yaml`.
2. Онови інтеграційні readme в `docs/readme`.
3. Онови `docs/readme/CHANGELOG_API.md` і перевір відповідність `docs/readme/API_VERSIONING_POLICY.md`.
4. Онови Postman collection у `docs/postman`.
5. Прожени `npm run lint` (Redocly) + релевантні тести.
