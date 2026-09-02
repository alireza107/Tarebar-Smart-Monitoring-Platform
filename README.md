# Tarebar Smart Monitoring Platform

سامانه هوشمند مدیریت میادین میوه و تره‌بار — a Next.js 15 management platform for fruit and vegetable markets, covering the full hierarchy of Fields → Markets → Booths with user management, camera monitoring, and role-based access control.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript strict) |
| UI | TailwindCSS v4 + shadcn/ui |
| Auth | Auth.js v5 (Credentials + JWT) |
| Database | PostgreSQL 16 + Prisma ORM 6 |
| Validation | Zod v4 |
| Forms | React Hook Form |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 |
| Logging | Pino |
| Testing | Vitest |

---

## Prerequisites

- Node.js 20+ (only for host-side `npm run dev`)
- Docker with Compose v2
- A sibling clone of the video analytics repository (`../video_analytics` by default)

---

## Local Development

Two workflows are supported. Full-stack Docker is the default for working on
the complete system. Host-side Next.js remains available for UI-only work.

### Full stack with Docker (recommended)

1. Clone the application repositories as siblings:

   ```bash
   git clone <frontend-repo-url> Tarebar-Smart-Monitoring-Platform
   git clone <video-analytics-repo-url> video_analytics
   cd Tarebar-Smart-Monitoring-Platform
   ```

2. Review `.env.dev` (localhost URLs and development credentials). Copy
   `.env.example` if you need a fresh catalog. For LAN / phone access, set
   `NEXT_PUBLIC_MEDIAMTX_*` and `MEDIAMTX_WEBRTC_HOST` to the Docker host IP.

3. Start every service from source (no GHCR access required):

   ```bash
   docker compose -f docker-compose.dev.yml up
   ```

   First run (or after dependency changes) add `--build`. `docker compose up`
   still works; `docker-compose.yml` includes the development file.

4. First time only, seed the admin user:

   ```bash
   docker compose -f docker-compose.dev.yml --env-file .env.dev exec app npx prisma db seed
   ```

Open [http://localhost:3000](http://localhost:3000). Source is bind-mounted:
frontend uses Next.js hot reload; video-analytics runs uvicorn `--reload`.

Default admin account: **username** `admin` · **password** `Admin@1234`

See [Live-Cameras-MediaMTX.md](docs/Live-Cameras-MediaMTX.md) for Larix,
WebRTC, RTSP/IP-camera, firewall, and live-CV setup.

### Host-side Next.js (database in Docker)

```bash
git clone <repo-url>
cd Tarebar-Smart-Monitoring-Platform
npm install
cp .env.example .env.local
# Edit .env.local — set AUTH_SECRET to a strong random value:
# openssl rand -base64 32

docker compose -f docker-compose.dev.yml --env-file .env.dev up -d db
npx prisma migrate dev
npx prisma db seed
npm run dev
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npx prisma migrate dev` | Apply DB migrations |
| `npx prisma studio` | Open Prisma Studio |
| `npx prisma db seed` | Seed the database |

---

## Production — GHCR images

Production does **not** build from this repository. GitHub Actions
(`.github/workflows/build-image.yml`) pushes `ghcr.io/<owner>/frontend:<sha>`
and `ghcr.io/<owner>/frontend:<tag>` (for example `v1.0.0`). The sibling
video-analytics repository publishes `ghcr.io/<owner>/video-analytics:<version>`.

Servers clone the **deployment** repository only and pull those images:

```bash
cd tarebar-deployment
docker compose pull
docker compose up -d
```

See that repository's README for `.env.production`, GHCR login, and migrations.
Do not use `build:` or application source mounts on the server.

Set these GitHub Actions **repository variables** before tagging a production
frontend release (`NEXT_PUBLIC_*` values are baked in at image build time):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Public base URL of the app |
| `NEXT_PUBLIC_VIDEO_ANALYTICS_API_URL` | Public video-analytics API URL |
| `NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL` | Public MediaMTX WebRTC URL |
| `NEXT_PUBLIC_MEDIAMTX_HLS_URL` | Public MediaMTX HLS URL |

Local Docker Compose still uses `.env.dev` and source builds. Required local
variables are documented in `.env.example`.

---

## Architecture

**Modular Monolith** — one Next.js app with clear module boundaries per domain entity.

```
Field → Market → Booth
```

Each domain module lives in `src/modules/[name]/` and follows the same four-file pattern:

```
types.ts        # TypeScript interfaces
schema.ts       # Zod schemas (Create / Update DTOs)
repository.ts   # Prisma queries only — no business logic
service.ts      # Business logic — calls repository
```

API route handlers live in `src/app/api/[resource]/route.ts` and follow a consistent pattern:
authenticate → authorize (`checkPermission`) → validate input (Zod) → call service.

All deletes are **soft deletes** — records are never physically removed (see `deletedAt` field).

---

## Authorization

Three roles with RBAC enforced in `src/lib/permissions.ts`:

| Resource | ORG_ADMIN | FIELD_MANAGER | MARKET_MANAGER |
|---|---|---|---|
| Field | CRUD | R | — |
| Market | CRUD | CRUD | R |
| Booth | CRUD | CRUD | CRUD |
| BoothCategory | CRUD | CRUD | R |
| User | CRUD | R | R |
| Camera | CRUD | CRUD | R |
| Report | CRUD | R | R |

Scope enforcement (own field / own market only) is applied in the service layer.

---

## API Routes

| Route | Methods |
|---|---|
| `/api/fields` | GET · POST |
| `/api/fields/[id]` | GET · PATCH · DELETE |
| `/api/markets` | GET · POST |
| `/api/markets/[id]` | GET · PATCH · DELETE |
| `/api/booth-categories` | GET · POST |
| `/api/booth-categories/[id]` | GET · PATCH · DELETE |
| `/api/booths` | GET · POST |
| `/api/booths/[id]` | GET · PATCH · DELETE |
| `/api/users` | GET · POST |
| `/api/users/[id]` | GET · PATCH · DELETE |
| `/api/cameras` | GET · POST |
| `/api/cameras/[id]` | GET · PATCH · DELETE |
| `/api/dashboard/stats` | GET |
| `/api/reports` | GET |

Recorded-video jobs are sent directly from the browser to the separately
running video analytics API. Generated videos, CSV files, event logs, and
heatmaps remain in the Video Analytics repository's `output/dashboard/<job-id>`
directory, isolated in one folder per dashboard processing job.

All routes return `{ data: ... }` on success. Errors use consistent codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

---

## Testing

Tests live alongside source files in `__tests__/` directories and cover:

- `src/lib/permissions.ts` — full RBAC matrix (all roles × resources × actions)
- `src/lib/api-responses.ts` — HTTP status codes and response shapes
- `src/modules/field/service.ts` — routing logic with mocked repository
- `src/modules/user/service.ts` — password hashing and conflict detection

```bash
npm test            # run once
npm run test:watch  # re-run on file change
```
