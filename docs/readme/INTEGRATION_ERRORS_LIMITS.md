# Integration Errors and Limits

## 1) Error envelope

```json
{
  "success": false,
  "error": {
    "code": "QUERY_INVALID",
    "message": "..."
  }
}
```

## 2) Найчастіші error codes

- `AUTH_MISSING` / `AUTH_INVALID` - відсутній або битий Bearer token.
- `ACCESS_DENIED` / `FORBIDDEN` - недостатня роль.
- `VALIDATION_ERROR` - невалідний body/params.
- `QUERY_INVALID` - невалідні query-параметри або заборонені комбінації фільтрів.
- `CURSOR_INVALID` - cursor не належить поточному режиму пагінації.
- `SHOWROOM_NOT_FOUND`, `LOOKBOOK_NOT_FOUND`, `EVENT_NOT_FOUND`, `NOTIFICATION_NOT_FOUND`.
- `SHOWROOM_LOCKED_PENDING` - редагування pending showroom заборонене.
- `EVENT_NAME_INVALID` - подія не входить до whitelist `/analytics/ingest`.

## 3) Auth / Role матриця

- Public read endpoints: дозволяють запит без токена.
- User mutate endpoints: обов'язковий токен.
- Admin endpoints: токен + роль `admin`.

Рекомендовані негативні тести для кожного protected endpoint:
- без токена -> `401`
- не та роль -> `403`
- битий payload -> `400`, не `500`

## 4) Cursor та pagination правила

- Cursor opaque; не розпарсювати на клієнті.
- Cursor не переноситься між режимами запиту.
  - Приклад: cursor з `/showrooms?limit=2` не валідний для `/showrooms?geohashPrefix=...`.
- При зміні будь-якого фільтра pagination сесію треба скидати.
- `limit` завжди проходить через бекенд-кламп (safe upper bound).

## 5) Ідемпотентність mutate endpoint-ів

Повторні виклики не повинні створювати дублікати станів:
- `POST|DELETE /showrooms/{id}/favorite`
- `POST|DELETE /lookbooks/{id}/favorite`
- `POST|DELETE /events/{id}/want-to-visit`
- `POST|DELETE /events/{id}/dismiss`
- `PATCH /users/me/notifications/{notificationId}/read`

## 6) Payload/throughput обмеження

- Analytics ingest: batch до 50 подій на запит.
- Analytics ingest має окремий rate-limit bucket.
- Для великих sync-пакетів застосовуються backend safety caps; клієнт має обробляти `applied/skipped`.

## 7) Контрактні гарантії

- Бізнес-операції не блокуються через непрацюючий push.
- Аналітика best-effort і не ламає основний флоу.
- Error response стабільний за формою для машинного парсингу.
