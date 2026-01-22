# JM Showroomer API v1

## Base URL

https://<BACKEND_URL>/api/v1

---

## Authentication

- OAuth via Google. Apple OAuth - coming soon (client ID/secret)
- Use header for protected routes:

Authorization: Bearer <ID_TOKEN>

- Guests (GUEST) can view content and add favorites locally (mobile storage).

---

## Roles

| Role    | Description                                         |
| ------- | --------------------------------------------------- |
| GUEST   | Unauthenticated visitor                             |
| USER    | Logged-in standard user                             |
| OWNER   | Showroom / Lookbook owner                           |
| STYLIST | Stylist (future role)                               |
| MANAGER | Manager (can create showrooms/lookbooks)            |
| ADMIN   | Admin (statistics, approve/reject showrooms/events) |

---

## Endpoints

| Method | Path                     | Auth Required | Roles                | Body                                 | Description          | Response                                 |
| ------ | ------------------------ | ------------- | -------------------- | ------------------------------------ | -------------------- | ---------------------------------------- |
| GET    | /health                  | No            | N/A                  | -                                    | Health check         | `{ status: "ok" }`                       |
| POST   | /auth/oauth              | No            | N/A                  | `{ "idToken": "<GOOGLE_ID_TOKEN>" }` | OAuth login          | `{ user: { uid, email, name } }`         |
| POST   | /auth/apple              | No            | N/A                  | TBD                                  | Apple OAuth (coming) | `{ message: "Apple OAuth coming soon" }` |
| GET    | /users                   | No            | N/A                  | -                                    | List users (public)  | `[{ uid, email, role }]`                 |
| POST   | /users/dev/register-test | Yes           | USER, OWNER, MANAGER | -                                    | Register test user   | `{ user: { uid, email } }`               |
| GET    | /showrooms               | No            | N/A                  | -                                    | List showrooms       | `[{ id, name, owner }]`                  |
| POST   | /showrooms/create        | Yes           | OWNER, MANAGER       | `{ "name": "New Showroom" }`         | Create showroom      | `{ id, name, owner }`                    |
| POST   | /showrooms/:id/favorite  | Yes           | USER, OWNER, MANAGER | -                                    | Add to favorites     | `{ message: "Added to favorites" }`      |
| GET    | /lookbooks               | No            | N/A                  | -                                    | List lookbooks       | `[{ id, name, owner }]`                  |
| POST   | /lookbooks/create        | Yes           | OWNER, MANAGER       | `{ "name": "New Lookbook" }`         | Create lookbook      | `{ id, name, owner }`                    |
| POST   | /lookbooks/:id/rsvp      | Yes           | USER, OWNER, MANAGER | -                                    | RSVP event           | `{ eventId, user, status }`              |

---

## Role Details

- **GUEST**: Can browse showrooms/lookbooks, save favorites locally. Cannot create content.
- **USER**: Can login via Google, save favorites server-side, RSVP events. Cannot create showrooms/lookbooks.
- **OWNER**: Can create/show/manage own showrooms/lookbooks. Access restricted routes.
- **MANAGER**: Can create/showrooms/lookbooks, similar to OWNER.
- **STYLIST**: Future extension, currently no access.
- **ADMIN**: Full access to statistics and approve/reject showrooms/events.

---

## Notes

- All protected endpoints require valid `idToken`.
- API versioning is under `/api/v1`.
- Roles are enforced via `requireRole` middleware.
- Guests are handled separately with local storage for favorites if not logged in.
```
