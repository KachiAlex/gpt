# Government Project Tracker

Digital accountability platform for Abia State, Nigeria. Government officials track
public projects, contractors submit progress reports, and M&E officers review them.
Includes a public transparency portal.

## Architecture

| Layer    | Stack |
|----------|-------|
| Frontend | React 19, Vite 7, Tailwind CSS, React Router 7, Recharts, socket.io-client — hosted on **Vercel** |
| Backend  | Node.js, Express 5, TypeScript, raw `pg` (repository layer), JWT, Socket.IO, Multer |
| Database | PostgreSQL 16 (Docker) |
| Deploy   | Backend + Postgres in Docker Compose on a self-hosted VPS; frontend on Vercel |

Roles: `GOVERNMENT_ADMIN`, `GOVERNMENT_OFFICER`, `CONTRACTOR`, `ME_OFFICER`, `PUBLIC`.

> The Express + PostgreSQL backend in `backend/` is the only supported API.

## Repository layout

```
src/                  React frontend (Vite)
backend/              Express + PostgreSQL API (TypeScript)
backend/migrations/   SQL schema (auto-applied on first DB boot)
docker-compose.yml    Postgres + API containers
deploy-vps.sh         VPS deployment script (run on the server)
```

## Local development

```bash
# Backend
cd backend
cp env.example .env          # or ../env.example for reference
npm install
# Start a local Postgres, set DATABASE_URL in .env, then:
psql "$DATABASE_URL" -f migrations/20260313_render_initial_schema.sql
npm run dev                  # http://localhost:5000

# Frontend (separate terminal)
npm install
npm run dev                  # http://localhost:5173
```

## VPS deployment (Docker)

Requires Docker + Docker Compose on the server.

```bash
# On the VPS, inside the project directory:
cp env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGIN, ADMIN_PASSWORD
./deploy-vps.sh            # builds & starts db + api
./deploy-vps.sh --seed     # (optionally) create the admin user
```

- Postgres data persists in the `pgdata` volume; uploads persist in `uploads`.
- The schema in `backend/migrations/` is applied automatically the first time
  the database container boots.
- The API container binds `127.0.0.1:5055` on the VPS; nginx fronts it at
  `https://gpt-api.67-211-210-8.sslip.io` (health: `GET /health`, API: `/api/*`).
- Socket.IO runs on the same origin (nginx proxies the websocket upgrade).

### One-time admin seeding

`POST /api/seed` creates/updates the admin account from `ADMIN_*` env vars.
Without `SEED_KEY` set it only works when **no admin exists yet**; afterwards it
requires the `X-Seed-Key: <SEED_KEY>` header. `./deploy-vps.sh --seed` uses the
`create-admin-user` script instead.

## Frontend deployment (Vercel)

Import the repo into Vercel — `vercel.json` already selects the Vite framework
and adds the SPA rewrite. Set these environment variables in the Vercel project
settings (they're baked in at build time):

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://gpt-api.67-211-210-8.sslip.io/api` |
| `VITE_SOCKET_URL` | `https://gpt-api.67-211-210-8.sslip.io` |

`.env.production` carries the same defaults. Then add your Vercel domain to the
`CORS_ORIGIN` list in the VPS `.env` (`*.vercel.app` wildcards are supported).

## Frontend configuration

| File | Purpose |
|------|---------|
| `.env.production` | `VITE_API_URL`, `VITE_SOCKET_URL` baked into `npm run build` |
| `src/services/api.js` | Falls back to `https://gpt-api.67-211-210-8.sslip.io/api` in production, `localhost:5000` in dev |

## Verification

```bash
cd backend && npm run build      # TypeScript compile
npm run build                    # frontend Vite build (repo root)
docker compose config            # validate compose file
```

## Security notes

- Public registration only permits `CONTRACTOR`/`PUBLIC` roles; privileged roles
  are created by admins via `POST /api/auth/register` with an admin Bearer token.
- JWT secret is required (no fallback default).
- Uploaded files land under `backend/uploads/` (`public/` served statically,
  everything else via authenticated `GET /api/files/download/:id`).
