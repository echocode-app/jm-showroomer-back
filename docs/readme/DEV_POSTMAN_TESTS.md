# DEV Postman Tests (Full Backend Scenarios)

## 0) Підготовка Postman Environment

Створи Environment змінні:
- `baseUrl` = `http://localhost:3005/api/v1`
- `idToken_user`
- `idToken_owner`
- `idToken_admin`
- `auth_user` = `Bearer {{idToken_user}}`
- `auth_owner` = `Bearer {{idToken_owner}}`
- `auth_admin` = `Bearer {{idToken_admin}}`
- `showroom_id`
- `lookbook_id`
- `event_id`
- `notification_id`
- `cursor`

## 1) Health + базова доступність

### 1.1 Health
```http
GET {{baseUrl}}/health
```
Очікування:
- `200`
- `success=true`

### 1.2 Root sanity
```http
GET http://localhost:3005/
```
Очікування:
- `200`

## 2) Auth сценарії

### 2.1 OAuth login (valid)
```http
POST {{baseUrl}}/auth/oauth
Content-Type: application/json

{
  "idToken": "{{idToken_user}}"
}
```
Очікування:
- `200`
- повертається `user`

### 2.2 OAuth login (missing token)
```http
POST {{baseUrl}}/auth/oauth
Content-Type: application/json

{}
```
Очікування:
- `400`
- `ID_TOKEN_REQUIRED`

## 3) Users / profile сценарії

### 3.1 Get me
```http
GET {{baseUrl}}/users/me
Authorization: {{auth_user}}
```
Очікування:
- `200`
- `data.uid` існує

### 3.2 Profile update
```http
PATCH {{baseUrl}}/users/profile
Authorization: {{auth_user}}
Content-Type: application/json

{
  "appLanguage": "uk",
  "notificationsEnabled": true
}
```
Очікування:
- `200`

### 3.3 Complete owner profile
```http
POST {{baseUrl}}/users/complete-owner-profile
Authorization: {{auth_user}}
Content-Type: application/json

{
  "name": "Owner Test",
  "country": "Ukraine",
  "instagram": "https://instagram.com/owner_test",
  "position": "Owner"
}
```
Очікування:
- `200`
- `role=owner`

## 4) Device registration / push prerequisites

### 4.1 Register device
```http
POST {{baseUrl}}/users/me/devices
Authorization: {{auth_user}}
Content-Type: application/json

{
  "deviceId": "dev-ios-1",
  "fcmToken": "fake-fcm-token-1",
  "platform": "ios",
  "appVersion": "1.0.0",
  "locale": "uk-UA"
}
```
Очікування:
- `200`
- `data.success=true`

### 4.2 Update same device (upsert)
```http
POST {{baseUrl}}/users/me/devices
Authorization: {{auth_user}}
Content-Type: application/json

{
  "deviceId": "dev-ios-1",
  "fcmToken": "fake-fcm-token-2",
  "platform": "ios",
  "appVersion": "1.0.1",
  "locale": "uk-UA"
}
```
Очікування:
- `200`

### 4.3 Delete device
```http
DELETE {{baseUrl}}/users/me/devices/dev-ios-1
Authorization: {{auth_user}}
```
Очікування:
- `200`

## 5) Showrooms owner/admin flow

### 5.1 Create draft showroom
```http
POST {{baseUrl}}/showrooms/draft
Authorization: {{auth_owner}}
Content-Type: application/json

{
  "name": "Flow Showroom",
  "country": "Ukraine"
}
```
Після запиту збережи `data.showroom.id` у `showroom_id`.

### 5.2 Update showroom
```http
PATCH {{baseUrl}}/showrooms/{{showroom_id}}
Authorization: {{auth_owner}}
Content-Type: application/json

{
  "city": "Kyiv",
  "address": "Khreshchatyk 1",
  "contacts": {
    "phone": "+380501112233",
    "instagram": "https://instagram.com/flow_showroom"
  }
}
```

### 5.3 Submit showroom
```http
POST {{baseUrl}}/showrooms/{{showroom_id}}/submit
Authorization: {{auth_owner}}
```
Очікування:
- `200`
- `pending`

### 5.4 Approve showroom (admin)
```http
POST {{baseUrl}}/admin/showrooms/{{showroom_id}}/approve
Authorization: {{auth_admin}}
```
Очікування:
- `200`
- статус `approved`

### 5.5 Reject showroom (alt scenario)
```http
POST {{baseUrl}}/admin/showrooms/{{showroom_id}}/reject
Authorization: {{auth_admin}}
Content-Type: application/json

{
  "reason": "Incomplete contacts"
}
```
Очікування:
- `200`

## 6) Showroom favorites

### 6.1 Favorite
```http
POST {{baseUrl}}/showrooms/{{showroom_id}}/favorite
Authorization: {{auth_user}}
```

### 6.2 Favorite again (idempotent)
```http
POST {{baseUrl}}/showrooms/{{showroom_id}}/favorite
Authorization: {{auth_user}}
```
Очікування:
- обидва `200`

### 6.3 Unfavorite
```http
DELETE {{baseUrl}}/showrooms/{{showroom_id}}/favorite
Authorization: {{auth_user}}
```

## 7) Lookbooks flow

### 7.1 Create lookbook
```http
POST {{baseUrl}}/lookbooks/create
Authorization: {{auth_owner}}
Content-Type: application/json

{
  "imageUrl": "https://example.com/lookbook.jpg",
  "showroomId": "{{showroom_id}}",
  "description": "Lookbook flow"
}
```
Збережи `data.lookbook.id` у `lookbook_id`.

### 7.2 Favorite lookbook
```http
POST {{baseUrl}}/lookbooks/{{lookbook_id}}/favorite
Authorization: {{auth_user}}
```

### 7.3 Unfavorite lookbook
```http
DELETE {{baseUrl}}/lookbooks/{{lookbook_id}}/favorite
Authorization: {{auth_user}}
```

## 8) Events flow + want-to-visit

### 8.1 List events
```http
GET {{baseUrl}}/events
Authorization: {{auth_user}}
```
Візьми `data.events[0].id` у `event_id`.

### 8.2 Want-to-visit
```http
POST {{baseUrl}}/events/{{event_id}}/want-to-visit
Authorization: {{auth_user}}
```

### 8.3 Remove want-to-visit
```http
DELETE {{baseUrl}}/events/{{event_id}}/want-to-visit
Authorization: {{auth_user}}
```

### 8.4 Dismiss / undismiss
```http
POST {{baseUrl}}/events/{{event_id}}/dismiss
Authorization: {{auth_user}}
```
```http
DELETE {{baseUrl}}/events/{{event_id}}/dismiss
Authorization: {{auth_user}}
```

## 9) Guest sync сценарії

### 9.1 Showrooms favorites sync
```http
POST {{baseUrl}}/collections/favorites/showrooms/sync
Authorization: {{auth_user}}
Content-Type: application/json

{
  "favoriteIds": ["{{showroom_id}}"]
}
```

### 9.2 Lookbooks favorites sync
```http
POST {{baseUrl}}/collections/favorites/lookbooks/sync
Authorization: {{auth_user}}
Content-Type: application/json

{
  "favoriteIds": ["{{lookbook_id}}"]
}
```

### 9.3 Events sync
```http
POST {{baseUrl}}/collections/want-to-visit/events/sync
Authorization: {{auth_user}}
Content-Type: application/json

{
  "wantToVisitIds": ["{{event_id}}"],
  "dismissedIds": []
}
```

## 10) Notifications read/unread сценарії

### 10.1 List notifications
```http
GET {{baseUrl}}/users/me/notifications?limit=20
Authorization: {{auth_owner}}
```
Візьми `data.items[0].id` -> `notification_id`.

### 10.2 Mark as read
```http
PATCH {{baseUrl}}/users/me/notifications/{{notification_id}}/read
Authorization: {{auth_owner}}
```

### 10.3 Unread count
```http
GET {{baseUrl}}/users/me/notifications/unread-count
Authorization: {{auth_owner}}
```

### 10.4 Cursor paging
```http
GET {{baseUrl}}/users/me/notifications?limit=2
Authorization: {{auth_owner}}
```
Потім:
```http
GET {{baseUrl}}/users/me/notifications?limit=2&cursor={{cursor}}
Authorization: {{auth_owner}}
```

## 11) Push logic validation (без реального девайса)

- Зареєструй fake device token для target user.
- Згенеруй notification trigger (approve/reject/favorite/want-to-visit).
- Перевір:
  - API відповідає успішно навіть якщо push не відправився.
  - нотифікація в storage створена.
  - повторна та сама дія не створює дубль push через dedupe notification id.

## 12) Error cases (обов’язково)

### 12.1 Missing auth
- Будь-який auth endpoint без токена -> `401 AUTH_MISSING`.

### 12.2 Invalid params/body
- invalid `limit`, invalid payload fields -> `400 QUERY_INVALID` або `VALIDATION_ERROR`.

### 12.3 Forbidden role
- user на admin endpoint -> `403 ACCESS_DENIED`.

### 12.4 Invalid cursor
- random cursor string -> `400 CURSOR_INVALID`.

### 12.5 Country restrictions
- blocked country value -> `403 COUNTRY_BLOCKED`.
