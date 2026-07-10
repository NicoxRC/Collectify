# Environment Variables

This document explains every environment variable used across `api` and `client`, what it's for, and where to get its value.

## Environments

Currently the project runs in two contexts:

- **Local development** — your machine, using the `.env` file, with PostgreSQL running via Docker.
- **Production** — deployed on Railway (`api`) and Cloudflare Pages (`client`), with variables set through each platform's dashboard, never committed to the repo.

There is no `staging` environment yet. If one is introduced later, this document will be updated with the corresponding variable set.

## General rules

- **Never commit a `.env` file.** It's listed in `.gitignore` for exactly this reason.
- **Every variable must exist in `.env.example`**, with a placeholder or dummy value — this is how a new developer knows what to fill in.
- If you add a new environment variable, update `.env.example` **and** this document in the same Pull Request (see `DEFINITION_OF_DONE.md`).
- Production values are set directly in Railway's / Cloudflare Pages' environment variable settings — never sent over Slack, WhatsApp, or committed anywhere.

---

## API (`apps/api/.env`)

```bash
# ── Server ──────────────────────────────────────────────
NODE_ENV=development
PORT=3000

# ── Database ────────────────────────────────────────────
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=collectify

# ── Auth ────────────────────────────────────────────────
JWT_SECRET=replace-with-a-long-random-string
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# ── WhatsApp — Meta Cloud API ───────────────────────────
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_BUSINESS_ACCOUNT_ID=

# ── Scheduled job ───────────────────────────────────────
OVERDUE_REMINDER_CRON=0 9 * * 1

# ── CORS ────────────────────────────────────────────────
CLIENT_URL=http://localhost:5173
```

### Variable reference

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | ✅ | `development` locally, `production` on Railway. Controls things like error verbosity and TypeORM `synchronize` (always `false`, see `DATABASE.md`). |
| `PORT` | ✅ | Port the API listens on. Railway overrides this automatically in production via its own `PORT` variable. |
| `DATABASE_HOST` | ✅ | `localhost` locally (via Docker); Railway provides this automatically in production through its PostgreSQL plugin. |
| `DATABASE_PORT` | ✅ | `5432` by default. |
| `DATABASE_USER` | ✅ | Postgres user. Matches the `docker-compose.yml` credentials locally. |
| `DATABASE_PASSWORD` | ✅ | Postgres password. **Never use the local default value in production** — Railway generates a strong one automatically. |
| `DATABASE_NAME` | ✅ | Database name, `collectify` by convention. |
| `JWT_SECRET` | ✅ | Single secret used to sign both access and refresh tokens. Must be a long, random string in production (generate with `openssl rand -hex 64`). **Never reuse the local dev value in production.** |
| `JWT_ACCESS_EXPIRATION` | ✅ | Access token lifetime. `15m` is the current standard — short-lived by design. |
| `JWT_REFRESH_EXPIRATION` | ✅ | Refresh token lifetime. `7d` — after this, the user must log in again. |
| `META_WHATSAPP_PHONE_NUMBER_ID` | ⚠️ Pending | Meta's identifier for the WhatsApp Business phone number. **Not yet available — the client hasn't set up their Meta Business account.** Leave blank locally until provided; the `whatsapp` module should handle a missing value gracefully in development (log instead of send). |
| `META_WHATSAPP_ACCESS_TOKEN` | ⚠️ Pending | Access token from the Meta for Developers app. Same status as above — pending client setup. |
| `META_WHATSAPP_BUSINESS_ACCOUNT_ID` | ⚠️ Pending | The WhatsApp Business Account ID tied to the Meta app. Same status as above. |
| `OVERDUE_REMINDER_CRON` | ✅ | Cron expression controlling when the weekly reminder job runs. Default `0 9 * * 1` = every Monday at 9:00 AM. |
| `CLIENT_URL` | ✅ | The client's URL, used to configure CORS. `http://localhost:5173` locally; the Cloudflare Pages URL in production. |

### On the pending Meta Cloud API credentials

Since the client hasn't finished setting up their Meta Business account yet, the `WhatsAppService` should be built to **fail gracefully** when these variables are empty — logging a warning and skipping the actual API call — rather than crashing the whole application on startup. This lets development continue on every other module without being blocked. Once the client provides these values, they get added to Railway's production environment variables (and to a developer's local `.env` for testing against the real API).

---

## Client (`apps/client/.env.local`)

Vite only exposes variables prefixed with `VITE_` to the frontend code — this is a security measure so that server-only secrets are never accidentally bundled into the browser build.

```bash
VITE_API_URL=http://localhost:3000/api/v1
```

### Variable reference

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Base URL the client uses to reach the API. Points to `localhost:3000` locally; points to the Railway-deployed API URL in production. |

Accessed in code as:

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

---

## Setting variables in production

- **Railway (`api`)**: Project → Variables tab. Railway automatically injects `DATABASE_HOST`, `DATABASE_PORT`, etc. when a PostgreSQL plugin is attached — don't hardcode these, reference Railway's provided values.
- **Cloudflare Pages (`client`)**: Project → Settings → Environment Variables. Remember `client` variables are baked into the build at build time, not read at runtime — redeploying is required after changing one.

## Related documents

- `README.md` — initial local setup steps that reference this file
- `DATABASE.md` — database configuration these variables connect to
- `DEFINITION_OF_DONE.md` — requirement to update this file when adding new variables
