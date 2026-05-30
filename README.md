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

- Node.js 20+
- Docker (for the database)

---

## Local Development

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd tarebar
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
# Edit .env.local — set AUTH_SECRET to a strong random value:
# openssl rand -base64 32
```

### 3. Start the database

```bash
docker compose up -d db
```

### 4. Run migrations and seed

```bash
npx prisma migrate dev
npx prisma db seed
```

Default admin account: **username** `admin` · **password** `Admin@1234`

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

## Production — Docker Compose

The included `docker-compose.yml` runs both the Next.js app and PostgreSQL in containers.

```bash
# Build and start all services
docker compose up -d --build

# Apply migrations inside the app container (first deploy only)
docker compose exec app npx prisma migrate deploy

# View logs
docker compose logs -f app
```

Required environment variables (set in your shell or a `.env` file at the project root):

| Variable | Description |
|---|---|
| `AUTH_SECRET` | Random secret for Auth.js JWT signing |
| `AUTH_URL` | Public base URL of the app (e.g. `https://tarebar.example.com`) |
| `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` — used client-side |

`DATABASE_URL` is wired automatically from the `db` service inside compose.

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
