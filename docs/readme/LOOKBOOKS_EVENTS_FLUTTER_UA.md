# Lookbooks + Events Flutter Guide (UA)

Короткий контракт для Flutter по локалізації й зовнішніх лінках.

## 1) Lookbooks

- `items[].nameKey`
  - основне стабільне поле для локалізації назви одягу;
  - Flutter має локалізувати по `nameKey`;
  - якщо для ключа немає перекладу, fallback -> `items[].name`.

- `items[].name`
  - fallback display string;
  - не покладатися на нього як на єдине localization source.

- `items[].link`
  - зовнішній tappable URL для картки одягу.

- `author.instagram`
  - зовнішній tappable URL автора/стиліста.

- `country`
  - canonical backend country name (`Ukraine`, `Poland`, ...).

- `countryNormalized`
  - lowercased stable key (`ukraine`, `poland`, ...);
  - Flutter може використовувати як internal key для локалізації/фільтрів.

## 2) Events

- `type`
  - це вже stable key для локалізації;
  - приклади: `pop_up`, `fashion_week`, `showcase`;
  - Flutter має локалізувати `type` локально.

- `country`
  - canonical backend country name (`Ukraine`, `Poland`, ...).

- `countryNormalized`
  - lowercased stable key (`ukraine`, `poland`, ...);
  - Flutter може використовувати як internal key для локалізації/фільтрів.

- `externalUrl`
  - зовнішній tappable URL для event detail / registration / Instagram.

## 3) Рекомендована Flutter логіка

1. Lookbook outfit label:
   - спробувати локалізувати `item.nameKey`
   - якщо перекладу нема -> показати `item.name`

2. Event badge / type label:
   - локалізувати `event.type`

3. Country label:
   - локалізувати локально у Flutter по `countryNormalized` або `country`
   - не чекати перекладеної назви країни з backend

4. External links:
   - відкривати `items[].link`, `author.instagram`, `externalUrl` як зовнішні URL

## 4) Важливий принцип масштабування

Для 20-30 мов backend не повинен повертати повні переклади всіх item labels.
Правильний підхід:

- backend повертає stable keys (`nameKey`, `type`, `countryNormalized`)
- Flutter локалізує їх у себе
- plain strings (`name`, `country`) лишаються fallback / canonical content
