# Uptime monitoring і Render keep-alive

Цей документ описує рекомендоване підключення UptimeRobot для backend API на Render.

## Ціль

- мати зовнішній uptime monitor для backend;
- на Render Free, за потреби, не давати сервісу засинати;
- не чіпати Firestore і бізнес-endpoint-и під час пінгів;
- мати простий аварійний вимикач.

## Endpoint для UptimeRobot

Використовувати:

```text
GET https://<render-service-url>/api/v1/health/ping
```

Це легкий endpoint:

- не потребує авторизації;
- не ходить у Firestore;
- не виконує бізнес-логіку;
- повертає `200` тільки коли `UPTIME_PING_ENABLED=true`.

Не використовувати для keep-alive:

- `/api/v1/health/ready` — він перевіряє Firestore і потрібен для readiness/dependency checks;
- бізнес endpoint-и — вони можуть створити зайве навантаження, rate-limit шум або side effects.

## Render env-перемикач

```text
UPTIME_PING_ENABLED=true
```

Значення:

- `true` або відсутнє значення — `/api/v1/health/ping` повертає `200`;
- `false` — endpoint повертає `404` з `UPTIME_PING_DISABLED`.

Важливо: цей env-перемикач не зупиняє HTTP-запити від UptimeRobot. Якщо монітор продовжує пінгувати Render URL, сам факт запиту все одно може розбудити Render Free service. Щоб реально вимкнути keep-alive traffic, треба поставити monitor на pause або видалити його в UptimeRobot.

## Рекомендований інтервал

Render Free засинає після приблизно 15 хв без inbound traffic.

Режими:

| Режим | Інтервал | Наслідок |
| --- | ---: | --- |
| Keep-alive на Render Free | 10 хв | Сервіс зазвичай не засинає. Більше використання free instance hours. |
| Мінімальний keep-alive запас | 12-14 хв | Теоретично достатньо, але залежить від точності scheduler-а монітора. |
| Uptime-only / економія | 20-30 хв | Сервіс може засинати. Перший запит після сну буде повільним. |
| Paid Render | 5-10 хв або 10-15 хв | Уже не для keep-alive, а для швидшого alerting. |

Практична рекомендація:

- `dev/free Render`: 10 хв, якщо треба тримати API теплим під QA/mobile тестування;
- `dev/free Render`, коли не тестуємо: pause monitor або 20-30 хв uptime-only;
- `prod paid Render`: 5-10 хв для uptime alerting, без потреби keep-alive.

## UptimeRobot: покрокове налаштування

1. Відкрити UptimeRobot і створити новий monitor.
2. Вибрати monitor type: `HTTP(s)`.
3. Name:

```text
JM Showroomer API - Render ping
```

4. URL:

```text
https://<render-service-url>/api/v1/health/ping
```

5. Monitoring interval:

```text
10 minutes
```

Для free-плану можна поставити мінімально доступний інтервал, якщо UI не дає рівно 10 хв. Якщо ціль не keep-alive, а тільки uptime alerting, ставити 20-30 хв, якщо план/UI це дозволяє.

6. Timeout:

```text
30 seconds
```

Якщо UptimeRobot не дає окремо налаштувати timeout на free-плані, залишити default.

7. Alert contacts:

- email власника/команди;
- за потреби Telegram/Slack/webhook, якщо доступно на поточному плані.

8. Створити monitor і дочекатись першого `Up`.
9. Перевірити вручну:

```bash
curl -i https://<render-service-url>/api/v1/health/ping
```

Очікувано:

```text
HTTP/2 200
```

10. Якщо треба тимчасово вимкнути keep-alive:

- основний спосіб: `Pause` monitor в UptimeRobot;
- додатковий safety switch: у Render поставити `UPTIME_PING_ENABLED=false` і redeploy/restart service.

## Alerting policy

Рекомендовано не реагувати на один одиничний failed check як на інцидент, особливо на Render Free.

Базова політика:

- alert після 2 consecutive failed checks;
- після alert перевірити Render dashboard: deploy status, logs, restarts;
- якщо `/api/v1/health/ping` працює, але бізнес endpoint-и ні, перевірити `/api/v1/health/ready` і Firestore credentials/indexes.

## Що перевіряти при падінні

1. Render service status.
2. Render logs за останні 10-15 хв.
3. `GET /api/v1/health/ping`.
4. `GET /api/v1/health/ready`.
5. Firebase env vars і Firestore availability, якщо падає тільки `/ready` або бізнес endpoint-и.

