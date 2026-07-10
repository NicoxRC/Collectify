# Phase 2 — Authentication and Roles (Backend)

## Goal
Users can log in with email/password, receive a JWT, and access is restricted by role (`admin` / `collector`).

## Reference
`docs/DATABASE.md` → `users` table. `docs/GLOSSARY.md` → Owner (Admin) and Collector roles.

## Scope

### Entity and migration
- [ ] `User` entity: `id`, `full_name`, `email` (unique), `password_hash`, `role` (enum: `admin`, `collector`), `is_active`, standard timestamps + soft delete
- [ ] Migration for the `users` table

### Auth logic
- [ ] Password hashing with `bcrypt` — never store plain text, never log the password anywhere
- [ ] `POST /api/v1/auth/login` — validates email/password, returns `{ accessToken, refreshToken }`
- [ ] `POST /api/v1/auth/refresh` — exchanges a valid refresh token for a new access token
- [ ] `POST /api/v1/auth/change-password` — authenticated endpoint, requires current password
- [ ] JWT strategy using `JWT_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` env vars

### Guards and decorators
- [ ] `JwtAuthGuard` — protects routes, applied globally with `@Public()` decorator to opt specific routes out (e.g. `/auth/login`, `/health`)
- [ ] `RolesGuard` + `@Roles(Role.Admin)` decorator — restricts specific endpoints to specific roles
- [ ] Apply guards to a placeholder/test endpoint to confirm both work correctly before moving on

### DTOs
- [ ] `LoginDto` (email, password) with `class-validator` decorators
- [ ] `RefreshTokenDto`
- [ ] `ChangePasswordDto`

### Tests (mandatory — see `docs/TESTING.md`)
- [ ] `AuthService`: login success, login with wrong password, login with non-existent email, token refresh success, token refresh with invalid/expired token, password change success, password change with wrong current password

### Swagger
- [ ] All auth endpoints documented with `@ApiOperation`, `@ApiResponse` for success and failure cases

## Definition of done for this phase

- A user can be manually inserted (via a seed script or a temporary insert) and log in successfully
- An invalid login attempt returns a clear 401, not a 500
- A protected test endpoint correctly rejects requests without a token, and correctly rejects a `collector` hitting an `admin`-only route
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## Notes

- There's no user self-registration in this system — users (Owner, Collector accounts) are created by an admin. A `POST /users` admin-only endpoint for creating accounts can either be built now or deferred to Phase 8 (Polish) — use your judgment, but if deferred, note it in the PR description so it isn't forgotten.
