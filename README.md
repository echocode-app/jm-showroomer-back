# JM Showroomer API v1

Backend API for mobile (Flutter) and web clients.

---

## Base URL

https://<BACKEND_URL>/api/v1

---

## Authentication

- Google OAuth via Firebase
- Apple OAuth — planned (not implemented)

### Authorization Header (required for protected routes)

Authorization: Bearer <ID_TOKEN>

Where `<ID_TOKEN>` is Firebase idToken received after Google Sign-In.

---

## Roles

| Role    | Description                     |
| ------- | ------------------------------- |
| GUEST   | Unauthenticated user            |
| USER    | Default authenticated user      |
| OWNER   | Business owner (after approval) |
| ADMIN   | Internal admin (approval only)  |
| MANAGER | Future role                     |
| STYLIST | Future role                     |

---

## Role Rules (important)

- GUEST: browse content only
- USER: default after login
- USER can request OWNER role
- OWNER permissions are granted **only after approval**
- Pending requests do **not** grant new access

---

## USER → OWNER Flow

1. User logs in via Google OAuth
2. Client stores Firebase idToken
3. Client requests profile:
   GET /users/me
4. USER sends role request:
   POST /users/request-owner
5. Backend stores:

```json
roleRequest: {
  "role": "owner",
  "status": "pending"
}
```

6. Frontend must show “Pending approval”

7. OWNER access is enabled only after backend role change

## Endpoints

### Health

**GET** `/health`  
Health check endpoint.

---

### Auth

**POST** `/auth/oauth`  
Google OAuth login.  
Body:

```json
{
  "idToken": "<GOOGLE_ID_TOKEN>"
}
```

## Auth

**POST** `/auth/apple`  
Apple OAuth (stub, not implemented yet).

---

## Users

**GET** `/users/me`  
Auth required.  
Returns current authenticated user profile.

**POST** `/users/request-owner`  
Auth required. Role: `USER`  
Request role upgrade from USER → OWNER.

**POST** `/users/dev/register-test`  
Dev only.  
Creates a test user in Firebase.

---

## Showrooms

**GET** `/showrooms`  
Public. List all showrooms.

**POST** `/showrooms/create`  
Auth required. Role: `OWNER`  
Create a showroom.

**POST** `/showrooms/:id/favorite`  
Auth required.  
Add showroom to favorites.

---

## Lookbooks

**GET** `/lookbooks`  
Public. List all lookbooks.

**POST** `/lookbooks/create`  
Auth required. Role: `OWNER`  
Create a lookbook.

**POST** `/lookbooks/:id/rsvp`  
Auth required.  
RSVP to lookbook event.

---

## Errors

- **401** — Not authenticated / invalid token
- **403** — Insufficient role
- **400** — Validation error
- **500** — Server error

---

## Notes for Flutter

- Always call **GET `/users/me`** immediately after login
- Never assume role locally
- Handle `roleRequest.status === "pending"`
- Do not unlock OWNER UI until role is updated on backend

---

## API Versioning

All routes are prefixed with:

`/api/v1`
