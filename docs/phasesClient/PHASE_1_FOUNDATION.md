# Phase 1 — Foundation (Client)

## Goal
A working, empty React + Vite app — scaffolded, deployed, able to reach the API's health check. No features yet. Mirrors `docs/phases/PHASE_1_FOUNDATION.md` on the `api` side; per `docs/PROJECT_ROADMAP.md`, both can be built in parallel once this shell exists.

## Scope

- [ ] Scaffold Vite + React + TypeScript project inside `apps/client/`
- [ ] Install and configure Tailwind CSS, per `docs/ARCHITECTURE.md`
- [ ] Install TanStack Query, set up `lib/queryClient.ts` and wrap the app in its provider
- [ ] Install React Router, base `routes/router.tsx`
- [ ] Base layout components: `components/layout/Sidebar.tsx`, `components/layout/Header.tsx`
- [ ] `lib/apiClient.ts` — base fetch wrapper: reads `VITE_API_URL`, attaches headers, parses the API's success/error response shapes from `docs/ARCHITECTURE.md` (`{ success, data, meta }` / `{ success, message, statusCode }`)
- [ ] ESLint + Prettier configured per `docs/CODING_STANDARDS.md` (named exports, import order, no `any`)
- [ ] `.env.example` with `VITE_API_URL`, per `docs/ENVIRONMENT_VARIABLES.md`
- [ ] A placeholder page that calls `GET /api/v1/health` through `apiClient` and renders the result — temporary, deleted once Phase 2 lands, just to prove the wiring works end to end
- [ ] Cloudflare Pages deployment configured
- [ ] `README.md` at repo root updated with `client` local setup steps

## Definition of done for this phase

- `npm run dev` runs locally with no errors
- `npm run build` and `npm run lint` both pass
- The deployed shell on Cloudflare Pages renders the base layout and successfully calls the deployed API's health check
- A developer can clone the repo and have `client` running locally within the steps in `README.md`

## Out of scope for this phase

No auth, no routing guards, no business features — that starts in Phase 2.

## Related documents

- `docs/ARCHITECTURE.md` — client folder structure and technical decisions (why Vite, why TanStack Query)
- `docs/ENVIRONMENT_VARIABLES.md` — `VITE_API_URL` and how client env vars work
- `docs/phases/PHASE_1_FOUNDATION.md` — the `api` counterpart to this phase
