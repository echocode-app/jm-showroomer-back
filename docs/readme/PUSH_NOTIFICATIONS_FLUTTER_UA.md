# Push Notifications для Flutter

Короткий покроковий flow для mobile-команди: що робити, в якому порядку, і який endpoint для чого потрібен.

Base URL:

- `https://<render-domain>/api/v1`

## 1. Загальний концепт

Є 2 окремі задачі:

1. Push delivery
- щоб backend міг надіслати push на девайс
- для цього Flutter повинен зареєструвати девайс через `POST /users/me/devices`

2. In-app notifications center
- щоб показувати список сповіщень у додатку
- для цього Flutter читає `/users/me/notifications*`

Без `POST /users/me/devices` push на телефон не прийде, навіть якщо notification doc уже створено.

## 2. Що робити після login

1. Отримати Firebase ID token
2. Викликати `GET /users/me`
3. Отримати FCM token на девайсі
4. Викликати `POST /users/me/devices`

## 3. Реєстрація девайса для push

Endpoint:

- `POST /users/me/devices`

Для чого:

- прив'язати поточний девайс і FCM token до користувача
- без цього backend не має куди надсилати push

Мінімальний payload:

```json
{
  "deviceId": "ios-physical-device-001",
  "fcmToken": "<FCM_TOKEN>",
  "platform": "ios"
}
```

Допустимі `platform`:

- `ios`
- `android`

Повторний виклик:

- нормальний сценарій
- викликати при першому login
- викликати при refresh FCM token
- викликати після reinstall, якщо `deviceId` або token змінився

## 4. Список нотифікацій у застосунку

Endpoint-и:

- `GET /users/me/notifications`
- `GET /users/me/notifications/unread-count`
- `PATCH /users/me/notifications/{notificationId}/read`

Порядок:

1. Для badge викликати `GET /users/me/notifications/unread-count`
2. Для списку викликати `GET /users/me/notifications`
3. При відкритті/тапі по елементу викликати `PATCH /users/me/notifications/{notificationId}/read`

## 5. Що саме чекати у MVP1

У mobile MVP1 backend доставляє тільки:

- `SHOWROOM_APPROVED`
- `SHOWROOM_REJECTED`

Інші історичні notification docs можуть існувати в Firestore, але нова MVP1-доставка на них не повинна орієнтуватися.

## 6. Як рендерити текст

Push:

- backend надсилає локалізований push text

In-app:

- Flutter має локалізувати текст локально по `type + payload`

## 7. Що робити при logout

Endpoint:

- `DELETE /users/me/devices/{deviceId}`

Для чого:

- відв'язати девайс від користувача
- щоб старий токен не лишався активним для push

## 8. Мінімальний happy path

1. Login
2. `GET /users/me`
3. Отримати FCM token
4. `POST /users/me/devices`
5. Отримати push після backend action
6. Показати список через `GET /users/me/notifications`
7. Оновити badge через `GET /users/me/notifications/unread-count`
8. Позначити read через `PATCH /users/me/notifications/{notificationId}/read`

## 9. Швидка перевірка інтеграції

Ознаки, що все підключено правильно:

- у backend логах є `POST /users/me/devices`
- у Firestore є `users/{uid}/devices/*`
- після approve/reject showroom у Firestore є `users/{uid}/notifications/*`
- якщо `PUSH_ENABLED=true`, push приходить на девайс
