# Phase 1 — Foundation (Backend)

## Goal
A working, empty NestJS API — deployed, connected to the database, with all cross-cutting plumbing in place. No business entities yet.

## Scope

- [ ] Scaffold NestJS project (`nest new api` or equivalent) inside `api/`
- [ ] Configure TypeORM connection to PostgreSQL, using env vars per `docs/ENVIRONMENT_VARIABLES.md`
- [ ] Set up `SnakeNamingStrategy` globally, per `docs/DATABASE.md`
- [ ] Configure `@nestjs/config` with validated, typed configuration (`config/configuration.ts`), per `docs/CODING_STANDARDS.md` — never read `process.env` directly elsewhere
- [ ] Global exception filter (`common/filters/httpException.filter.ts`) implementing the error response shape from `docs/ARCHITECTURE.md`
- [ ] Global response interceptor (`common/interceptors/response.interceptor.ts`) implementing the success response shape from `docs/ARCHITECTURE.md`
- [ ] API versioning prefix `/api/v1`
- [ ] Swagger setup (`@nestjs/swagger`) — base configuration, served at `/api/docs` or similar
- [ ] CORS configured to allow the `client` URL (`CLIENT_URL` env var)
- [ ] Health check endpoint: `GET /api/v1/health` → `{ status: 'ok' }`
- [ ] `docker-compose.yml` at repo root for local PostgreSQL
- [ ] TypeORM migration setup (CLI scripts in `package.json`: `migration:generate`, `migration:run`, `migration:revert`) — `synchronize: false` always, per `docs/DATABASE.md`
- [ ] ESLint + Prettier configured per `docs/CODING_STANDARDS.md`
- [ ] Jest configured (comes with Nest CLI by default) per `docs/TESTING.md`
- [ ] Deploy to Railway, confirm the health check responds in production

## Definition of done for this phase

- `npm run start:dev` runs locally against the Dockerized database with no errors
- `npm run lint` and `npm run test` both pass (even with zero business tests yet)
- The health check endpoint responds correctly both locally and on the Railway deployment
- Swagger UI is reachable and shows at least the health check endpoint documented

## Out of scope for this phase

No entities, no auth, no business logic — that starts in Phase 2.
