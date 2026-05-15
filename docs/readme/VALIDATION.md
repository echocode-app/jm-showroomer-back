# Validation Contract

This document mirrors backend validation rules that Flutter should enforce client-side where possible. It combines Joi request schemas with service-level validation, because some important checks happen after schema validation.

## Global Rules

- Request bodies reject unknown fields unless explicitly documented.
- Joi validation failures return `VALIDATION_ERROR`, except selected missing required fields.
- Missing required field mappings:
  - `name` -> `SHOWROOM_NAME_REQUIRED`
  - `type` -> `SHOWROOM_TYPE_REQUIRED`
  - `country` -> `COUNTRY_REQUIRED`
  - `idToken` -> `ID_TOKEN_REQUIRED`
- `VALIDATION_ERROR` responses can include `meta.fields` with `path`, `type`, and `message`.
- Server-managed and derived fields must never be sent by clients.

## Showroom Create

Endpoint: `POST /api/v1/showrooms/create`

Allowed body:

```json
{
  "name": "string",
  "type": "multibrand | unique",
  "country": "string",
  "availability": "open | appointment",
  "category": "any",
  "categoryGroup": "string",
  "subcategories": ["string"],
  "brands": ["string"],
  "address": "string | null | empty",
  "city": "string | null | empty",
  "contacts": {
    "phone": "string | null | empty",
    "instagram": "string | null | empty"
  },
  "location": {
    "lat": "number",
    "lng": "number"
  },
  "geo": {
    "city": "required non-empty string",
    "country": "required non-empty string",
    "coords": {
      "lat": "required number -90..90",
      "lng": "required number -180..180"
    },
    "placeId": "optional non-empty string",
    "cityNormalized": "optional compatibility input",
    "geohash": "optional compatibility input"
  },
  "draft": "boolean"
}
```

Non-draft create requires:

- `name`
- `type`
- `country`

Draft create requires:

- `draft: true`

Forbidden fields:

- `status`
- `ownerUid`
- `editCount`
- `editHistory`
- `nameNormalized`
- `addressNormalized`
- `brandsNormalized`
- `brandsMap`
- `submittedAt`

Create-specific service rules:

- `geo.country` must match top-level `country` by normalized country identity.
- `country` must not be blocked.
- If authenticated user has `country`, showroom `country` must match user country.
- Duplicate owner showroom with same normalized name and address returns `SHOWROOM_NAME_ALREADY_EXISTS`.
- Recreate cooldown can return `SHOWROOM_RECREATE_COOLDOWN`.

## Showroom Update

Endpoint: `PATCH /api/v1/showrooms/{id}`

Allowed body is partial, but at least one allowed field is required:

- `name`
- `type`
- `country`
- `availability`
- `category`
- `categoryGroup`
- `subcategories`
- `brands`
- `address`
- `city`
- `contacts`
- `location`
- `geo`

Field rules are the same as create.

Forbidden fields:

- `status`
- `ownerUid`
- `editCount`
- `editHistory`
- `pendingSnapshot`
- `deletedAt`
- `deletedBy`
- `reviewedAt`
- `reviewedBy`
- `reviewReason`
- `nameNormalized`
- `addressNormalized`
- `brandsNormalized`
- `brandsMap`
- `submittedAt`

Update-specific service rules:

- Only owner can update own showroom.
- Editable statuses: `draft`, `rejected`, `approved`.
- `pending` returns `SHOWROOM_LOCKED_PENDING`.
- `deleted` returns `SHOWROOM_NOT_EDITABLE`.
- If body produces no real diff, backend returns `NO_FIELDS_TO_UPDATE`.
- If updating an `approved` or `rejected` showroom, the resulting showroom must be complete.
- `geo.country` and top-level `country` must match by normalized country identity.
- `contacts` are merged with existing contacts; sending one contact field preserves the other existing contact fields.

## Showroom Submit

Endpoint: `POST /api/v1/showrooms/{id}/submit`

Body must be empty.

Path params:

```json
{
  "id": "required non-empty string"
}
```

Submit preconditions:

- Showroom exists.
- Current user owns the showroom.
- Showroom status is one of `draft`, `rejected`, `approved`.
- Showroom country is not blocked.
- Showroom country matches user country when user country exists.
- Showroom is complete.

Required completeness fields:

- `name`
- `type`
- `country`
- `address`
- `city` or `geo.city`
- `availability`
- `contacts.phone`
- `contacts.instagram`
- `geo.coords.lat` or `location.lat`
- `geo.coords.lng` or `location.lng`

Missing completeness fields return `SHOWROOM_INCOMPLETE`. The response message can contain concrete missing paths, for example:

```text
Missing fields: contacts.phone, contacts.instagram
```

Submit status rules:

- `pending` returns `SHOWROOM_LOCKED_PENDING`.
- `deleted` returns `SHOWROOM_NOT_EDITABLE`.
- Other unsupported statuses return `SHOWROOM_NOT_EDITABLE`.
- Successful submit moves showroom to `pending`; after that, owner PATCH/DELETE must stop.

## Showroom Review

Admin review body:

```json
{
  "reason": "required trimmed string min 3"
}
```

## Showroom Name

Server rule:

- Trimmed length: 2..15 Unicode characters.
- Cannot be digits only.
- Must contain at least one Unicode letter or number.
- Cannot contain the same character repeated 5 or more times.
- Emoji and surrogate pairs are rejected.
- Allowed characters: Unicode letters, Unicode numbers, spaces, hyphen, apostrophe, ampersand, dot, comma, parentheses.

Regex equivalent:

```regex
^[\p{L}\p{N}\s\-'&.,()]+$
```

Invalid name returns `SHOWROOM_NAME_INVALID`.

## Phone

Server normalization:

- Trim.
- Remove spaces, parentheses, and hyphens.

Server validation:

- Must not be empty when required by submit completeness.
- Must start with `+` when provided.
- Must parse and pass `libphonenumber-js` `parsePhoneNumberFromString(...).isValid()`.
- Persisted as E.164.

Invalid phone returns `PHONE_INVALID`.

Client note: regex and local length checks are not enough. Flutter should use a real phone parser or align with backend by validating E.164-compatible values.

## Instagram

Server normalization:

- `instagram.com/handle` -> `https://instagram.com/handle`
- `www.instagram.com/handle` -> `https://www.instagram.com/handle`
- Trailing slashes are removed.

Valid Instagram URL:

- Host must be `instagram.com` or `www.instagram.com`.
- No query string.
- No hash.
- Path must contain exactly one segment.
- Handle length: 1..30.
- Handle characters: `A-Z`, `a-z`, `0-9`, `.`, `_`.
- Handle cannot start with `.`.
- Handle cannot end with `.`.
- Handle cannot contain `..`.

Invalid Instagram returns `INSTAGRAM_INVALID`.

## Country

Backend accepts country names and ISO2 country codes through normalized country identity.

Blocked countries:

- `RU`
- `BY`
- Russia
- Belarus

Blocked country returns `COUNTRY_BLOCKED`.

Country mismatch rules:

- Create/update/submit require showroom country to match current user's country when user country exists.
- Mismatch returns `ACCESS_DENIED`.
- If `geo.country` is provided, it must match top-level `country`.
- `geo.country` mismatch returns `VALIDATION_ERROR`.

## Geo

`geo` object:

```json
{
  "city": "required non-empty string",
  "country": "required non-empty string",
  "coords": {
    "lat": "required number -90..90",
    "lng": "required number -180..180"
  },
  "placeId": "optional non-empty string"
}
```

Compatibility fields accepted but recomputed/ignored by backend:

- `geo.cityNormalized`
- `geo.geohash`

Backend derives:

- `geo.cityNormalized`
- `geo.geohash`
- top-level `city`
- top-level `location`

## Category

Valid `categoryGroup` values:

```json
["clothing", "footwear", "lingerie_swim", "accessories"]
```

Valid `subcategories` values:

```json
["outerwear", "dresses", "suits"]
```

Rules:

- Invalid category group returns `SHOWROOM_CATEGORY_GROUP_INVALID`.
- Invalid subcategory returns `SHOWROOM_SUBCATEGORY_INVALID`.
- Subcategories are currently only valid for `clothing`.
- If subcategories are provided and `categoryGroup` is omitted, backend resolves `categoryGroup` to `clothing`.
- If subcategories are provided with non-clothing category group, backend returns `SHOWROOM_SUBCATEGORY_GROUP_MISMATCH`.
- If changing category group away from `clothing` while existing subcategories remain, backend returns `SHOWROOM_SUBCATEGORY_GROUP_MISMATCH`.

## Brands

`brands` is an array.

Backend derives:

- `brandsNormalized`
- `brandsMap`

Clients must not send:

- `brandsNormalized`
- `brandsMap`

## Owner Profile

Endpoint: `POST /api/v1/users/complete-owner-profile`

```json
{
  "name": "required trimmed string 2..15",
  "position": "string | empty | null",
  "country": "required string",
  "phone": "trimmed string 3..50",
  "instagram": "required trimmed string 2..200"
}
```

Endpoint: `PATCH /api/v1/users/profile`

At least one field is required:

```json
{
  "name": "trimmed string 2..15",
  "country": "trimmed string 2..60",
  "phone": "trimmed string 3..50",
  "instagram": "trimmed string 2..200",
  "position": "trimmed string max 100 | empty | null",
  "appLanguage": "uk | en",
  "notificationsEnabled": "strict boolean"
}
```

Endpoint: `POST /api/v1/users/complete-onboarding`

```json
{
  "country": "required trimmed string 2..60"
}
```

## Auth

Endpoint: `POST /api/v1/auth/oauth`

```json
{
  "idToken": "required non-empty trimmed string"
}
```

Missing `idToken` returns `ID_TOKEN_REQUIRED`.

## Device Registration

Endpoint: `POST /api/v1/users/me/devices`

```json
{
  "deviceId": "required trimmed string 1..200",
  "fcmToken": "required trimmed string 1..4096",
  "platform": "ios | android",
  "appVersion": "trimmed string max 100 | empty | null",
  "locale": "trimmed string max 20 | empty | null"
}
```

Device path params:

```json
{
  "deviceId": "required trimmed string 1..200"
}
```

## Lookbook

Create body:

```json
{
  "imageUrl": "required http/https URI",
  "showroomId": "required trimmed string",
  "description": "optional trimmed string max 1000",
  "author": {
    "name": "required trimmed string 1..120",
    "position": "optional trimmed string 1..120",
    "instagram": "optional http/https URI"
  },
  "items": [
    {
      "name": "required trimmed string 1..120",
      "nameKey": "optional lowercase /^[a-z0-9_]+$/ 1..60",
      "brand": "optional trimmed string 1..120",
      "link": "required http/https URI"
    }
  ]
}
```

Update body:

- At least one field is required.
- Same fields as create.
- `description`, `author`, and `items` can be `null`.
- `items` max length is 30.

## Event and RSVP Params

For event/lookbook ID routes using `id` params:

```json
{
  "id": "required string"
}
```

## Client Handling Checklist

- Do not send server-managed fields.
- Do not send derived fields.
- Do not retry PATCH after successful submit.
- Treat `SHOWROOM_LOCKED_PENDING` as terminal UI state for owner editing until moderation finishes.
- Treat `NO_FIELDS_TO_UPDATE` as "nothing changed"; do not use it as a general success signal unless the user explicitly intended to submit unchanged data.
- Validate phone with a real phone parser, not just regex.
- Validate Instagram as a URL with exactly one handle segment.
- Keep top-level `country` and `geo.country` aligned.
- Stop duplicate mutation events while create/update/submit is in flight.

## Main Error Codes for Flutter

- `VALIDATION_ERROR`
- `SHOWROOM_NAME_REQUIRED`
- `SHOWROOM_TYPE_REQUIRED`
- `COUNTRY_REQUIRED`
- `SHOWROOM_NAME_INVALID`
- `SHOWROOM_CATEGORY_GROUP_INVALID`
- `SHOWROOM_SUBCATEGORY_INVALID`
- `SHOWROOM_SUBCATEGORY_GROUP_MISMATCH`
- `INSTAGRAM_INVALID`
- `PHONE_INVALID`
- `SHOWROOM_INCOMPLETE`
- `SHOWROOM_NOT_EDITABLE`
- `SHOWROOM_LOCKED_PENDING`
- `NO_FIELDS_TO_UPDATE`
- `SHOWROOM_NAME_ALREADY_EXISTS`
- `SHOWROOM_DUPLICATE`
- `SHOWROOM_RECREATE_COOLDOWN`
- `ACCESS_DENIED`
- `COUNTRY_BLOCKED`
- `ID_TOKEN_REQUIRED`
