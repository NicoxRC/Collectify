# Phase 2 — Authentication and Roles (Client)

## Goal
A user can log in, stay logged in across a refresh, and see a role-appropriate (even if empty) dashboard shell. Mirrors `docs/phases/PHASE_2_AUTH.md`.

## Reference
`docs/ARCHITECTURE.md` → Client routing and auth sections. `docs/GLOSSARY.md` → Owner (Admin) and Collector roles.

## Scope

### Auth feature
- [ ] `features/auth/authApi.ts` — raw calls to `POST /auth/login`, `POST /auth/refresh`, `POST /auth/change-password`
- [ ] `features/auth/useAuth.ts` — exposes current user, `login()`, `logout()`, auth status; handles the access/refresh token pair
- [ ] **Decide and document a token storage strategy before implementing** (e.g. access token in memory, refresh handled via a silent retry on 401) — `docs/ARCHITECTURE.md` doesn't currently prescribe one; note the choice made in the PR description so it can be revisited if it turns out wrong
- [ ] `lib/apiClient.ts` updated to attach the `Authorization` header and attempt one silent refresh on a `401` before failing

### Routing and guards
- [ ] `features/auth/LoginPage.tsx` — email/password form, calls `authApi.login`, redirects to the dashboard shell on success
- [ ] `ProtectedRoute` wrapper — redirects unauthenticated users to `/login`; wraps all routes except `/login`
- [ ] `routes/router.tsx` wired with the login route and the protected shell

### Role-based UI
- [ ] Sidebar nav items filtered by role per `docs/GLOSSARY.md` (`admin` sees everything; `collector` sees a restricted set — exact boundaries TBD as features land, start with what's obviously admin-only: user/template management)
- [ ] A collector navigating directly to an admin-only route (by URL) is redirected, not just visually hidden from the nav — don't rely on hidden nav links alone for access control

## Definition of done for this phase

- Both roles can log in and land on a role-appropriate (even if empty) dashboard shell
- An unauthenticated user hitting any protected route is redirected to `/login`
- A `collector` cannot reach an admin-only route by typing the URL directly
- A page refresh doesn't log the user out (session persists per the token strategy chosen above)

## Related documents

- `docs/phases/PHASE_2_AUTH.md` — the `api` counterpart, defines the JWT contract this phase consumes
- `docs/GLOSSARY.md` — role definitions
