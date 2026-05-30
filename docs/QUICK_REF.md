# Quick Reference — Tarebar

## Current Sprint
**All sprints complete — project is production-ready.**

Sprint Roadmap:
| # | Sprint | Status |
|---|--------|--------|
| 1 | Auth + Layout + RBAC | ✅ Done |
| 2 | Field Module | ✅ Done |
| 3 | Market Module | ✅ Done |
| 4 | Booth + BoothCategory | ✅ Done |
| 5 | User Management | ✅ Done |
| 6 | Camera Management | ✅ Done |
| 7 | Monitoring | ✅ Done |
| 8 | Reports + Dashboard | ✅ Done |
| 9 | Testing + Docker + Docs | ✅ Done |

---

## Local Development Setup

### Docker (PostgreSQL)
```bash
docker compose up -d      # start DB
docker compose down       # stop DB
```
`docker-compose.yml` runs `postgres:16-alpine` on port **5432**.

Credentials: `postgres / postgres` — DB name: `tarebar`

### First-run seed
```bash
npx prisma migrate dev    # apply migrations
npx prisma db seed        # create ORG_ADMIN
```
Default admin: **username:** `admin` · **password:** `Admin@1234`

---

## Sprint 9 Deliverables
- **Vitest** — test runner configured (`vitest.config.ts`); scripts `test`, `test:watch`, `test:coverage` added to `package.json`
- **Unit tests — permissions** — `src/lib/__tests__/permissions.test.ts` — full RBAC matrix (all 3 roles × 7 resources × 4 actions) + `checkPermission` + `PermissionError`
- **Unit tests — api-responses** — `src/lib/__tests__/api-responses.test.ts` — status codes and response shapes for all 5 helpers
- **Unit tests — field service** — `src/modules/field/__tests__/field-service.test.ts` — role routing (ORG_ADMIN vs FIELD_MANAGER), CRUD delegation with mocked repository
- **Unit tests — user service** — `src/modules/user/__tests__/user-service.test.ts` — password hashing, conflict detection, soft delete; bcrypt mocked
- **51 tests pass** across 4 test files
- **Dockerfile** — multi-stage production image (deps → builder → runner); non-root user; Next.js standalone output
- **`next.config.ts`** — `output: 'standalone'` added for Docker
- **`docker-compose.yml`** — updated with `app` service (build, env wiring, depends_on with healthcheck) alongside existing `db` service
- **`.env.example`** — template with all required environment variables and generation hints
- **`README.md`** — full project documentation: prerequisites, local setup, scripts, Docker deployment, architecture, RBAC table, API route table, testing summary

---

## Sprint 8 Deliverables
- **Dashboard** — `/dashboard` with 6 real stat widgets (Fields, Markets, Booths, Total/Online/Offline Cameras) fetched from `/api/dashboard/stats`
- **Reports page** — `/reports` with three scoped report sections:
  - Camera Status Summary (Online / Offline / Unknown counts)
  - Cameras per Field (table)
  - Booths per Market (table)
- **`/api/dashboard/stats`** — GET, returns live counts; scope-filtered for FIELD_MANAGER / MARKET_MANAGER
- **`/api/reports`** — GET, returns all three report sections; scope-filtered per role
- **`report` permission** added to RBAC (ORG_ADMIN CRUD, FIELD_MANAGER R, MARKET_MANAGER R)

---

## Sprint 7 Deliverables
- **Monitoring page** — `/monitoring` with camera grid (status summary + filter bar + auto-refresh every 30s)
- **CameraCard** — shows name, location, status badge, stream URL link
- **Status filter** — All / Online / Offline / Unknown toggle buttons
- **Auto-refresh** — `refetchInterval: 30_000` via TanStack Query; countdown indicator in header
- **Scope-aware** — reuses `/api/cameras` (already scoped per role)

---

## Sprint 6 Deliverables
- **Camera Module** — `src/modules/camera/` (types, schema, repository, service)
- **API routes** — `GET/POST /api/cameras`, `GET/PATCH/DELETE /api/cameras/[id]`
- **Cameras page** — `/cameras` with list table + create/edit dialog + delete
- **Location linking** — camera can be attached to a Field, Market, or Booth
- **Status badge** — ONLINE (green) / OFFLINE (red) / UNKNOWN (gray)
- **Scope filtering** — FIELD_MANAGER sees cameras in their fields; MARKET_MANAGER sees cameras in their markets

---

## Sprint 5 Deliverables
- **User Module** — `src/modules/user/` (types, schema, repository, service)
- **API routes** — `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/[id]`
- **Users page** — `/users` with list table + create/edit dialog + deactivate/delete
- **Password hashing** — bcryptjs on create; optional re-hash on update
- **Role-based access** — only ORG_ADMIN can create/update/delete; others read-only

---

## Sprint 4 Deliverables
- **BoothCategory Module** — `src/modules/booth-category/` (types, schema, repository, service)
- **API routes** — `GET/POST /api/booth-categories`, `GET/PATCH/DELETE /api/booth-categories/[id]`
- **Booth Categories page** — `/booth-categories` with list table + create/edit dialog + delete
- **Booth Module** — `src/modules/booth/` (types, schema, repository, service)
- **API routes** — `GET/POST /api/booths`, `GET/PATCH/DELETE /api/booths/[id]`
- **Booths page** — `/booths` with list table + create/edit dialog + delete
- **Scope filtering** — FIELD_MANAGER sees booths in their fields; MARKET_MANAGER sees booths in their markets

---

## Sprint 3 Deliverables
- **Market Module** — `src/modules/market/` (types, schema, repository, service)
- **API routes** — `GET/POST /api/markets`, `GET/PATCH/DELETE /api/markets/[id]`
- **Markets page** — `/markets` with list table + create/edit dialog + delete
- **Scope filtering** — FIELD_MANAGER sees markets in their fields; MARKET_MANAGER sees their assigned markets

---

## Sprint 2 Deliverables
- **Field Module** — `src/modules/field/` (types, schema, repository, service)
- **API routes** — `GET/POST /api/fields`, `GET/PATCH/DELETE /api/fields/[id]`
- **Fields page** — `/fields` with list table + create/edit dialog + delete

---

## Sprint 1 Deliverables
- **Next.js 15** scaffolded (App Router, TypeScript strict, TailwindCSS v4, Turbopack)
- **Prisma 6** schema: all entities with `deletedAt` soft delete
- **Auth.js v5 (beta)** — credentials provider + Prisma adapter + JWT strategy
- **Middleware** — unauthenticated → `/login`; logged-in on `/login` → `/dashboard`
- **RBAC helpers** — `hasPermission` / `checkPermission` / `PermissionError` in `src/lib/permissions.ts`
- **API response helpers** — `unauthorized`, `forbidden`, `notFound`, `validationError`, `serverError` in `src/lib/api-responses.ts`
- **Providers** — `SessionProvider` + `QueryProvider` in root layout (RTL, `lang="fa"`)
- **Dashboard shell** — Sidebar + Header + `(dashboard)` group layout
- **Login page** — `LoginForm` with React Hook Form + Zod validation

---

## Key File Locations

### Infrastructure
| Purpose | Path |
|---------|------|
| Prisma schema | `prisma/schema.prisma` |
| Prisma client singleton | `src/lib/db.ts` |
| Auth.js config | `src/lib/auth.ts` |
| Auth route handler | `src/app/api/auth/[...nextauth]/route.ts` |
| Middleware | `src/middleware.ts` |
| RBAC helpers | `src/lib/permissions.ts` |
| API response helpers | `src/lib/api-responses.ts` |
| Pino logger | `src/lib/logger.ts` |
| Session types | `src/types/next-auth.d.ts` |

### UI Shell
| Purpose | Path |
|---------|------|
| Dashboard layout | `src/app/(dashboard)/layout.tsx` |
| Sidebar | `src/components/sidebar.tsx` |
| Header | `src/components/header.tsx` |
| Login page | `src/app/(auth)/login/page.tsx` |

### Domain Modules (`src/modules/[name]/`)
| Module | Files |
|--------|-------|
| field | types · schema · repository · service |
| market | types · schema · repository · service |
| booth-category | types · schema · repository · service |
| booth | types · schema · repository · service |
| user | types · schema · repository · service |
| camera | types · schema · repository · service |
| report | types · repository *(read-only, no service/schema)* |

### API Routes
| Route | Methods |
|-------|---------|
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
| `/api/dashboard/stats` | GET — scoped counts for all 6 dashboard widgets |
| `/api/reports` | GET — camera status summary + cameras-by-field + booths-by-market |

---

## Module Pattern
Every domain module lives in `src/modules/[name]/`:

```
field/
  types.ts        # TS interfaces for this module
  schema.ts       # Zod schemas (create, update, query)
  repository.ts   # Prisma queries only — no business logic
  service.ts      # Business logic — calls repository
```

### schema.ts example
```ts
export const createFieldSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1),
})
export type CreateFieldDto = z.infer<typeof createFieldSchema>
```

### repository.ts example
```ts
export const fieldRepository = {
  findAll: (where?: Prisma.FieldWhereInput) =>
    db.field.findMany({ where: { ...where, deletedAt: null } }),
  findById: (id: string) =>
    db.field.findFirst({ where: { id, deletedAt: null } }),
  create: (data: CreateFieldDto) => db.field.create({ data }),
  update: (id: string, data: UpdateFieldDto) =>
    db.field.update({ where: { id }, data }),
  softDelete: (id: string) =>
    db.field.update({ where: { id }, data: { deletedAt: new Date() } }),
}
```

### service.ts example
```ts
export const fieldService = {
  getAll: async (userId: string, role: Role) => {
    return fieldRepository.findAll()
  },
}
```

---

## API Route Pattern
`src/app/api/[resource]/route.ts`

```ts
// GET /api/fields
export async function GET() {
  const session = await auth()
  if (!session) return unauthorized()

  checkPermission(session, 'field', 'read')  // throws PermissionError → catch below

  const fields = await fieldService.getAll(session.user.id, session.user.role as Role)
  return NextResponse.json({ data: fields })
}

// POST /api/fields
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()

  checkPermission(session, 'field', 'create')

  const body = await req.json()
  const parsed = createFieldSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const field = await fieldService.create(parsed.data)
  return NextResponse.json({ data: field }, { status: 201 })
}
```

`src/app/api/[resource]/[id]/route.ts` — GET, PATCH, DELETE by id

Wrap route handlers with a try/catch to handle `PermissionError`:
```ts
} catch (e) {
  if (e instanceof PermissionError) return forbidden()
  throw e
}
```

---

## Helper Responses (`src/lib/api-responses.ts`)
```ts
unauthorized()                    // 401
forbidden()                       // 403
notFound(message?)                // 404
validationError(zodError)         // 422
serverError(message?)             // 500
```

---

## RBAC Permission Matrix

| Resource | ORG_ADMIN | FIELD_MANAGER | MARKET_MANAGER |
|----------|-----------|---------------|----------------|
| Field | CRUD | R | — |
| Market | CRUD | CRUD | R |
| Booth | CRUD | CRUD | CRUD |
| BoothCategory | CRUD | CRUD | R |
| User | CRUD | R | R |
| Camera | CRUD | CRUD | R |
| Report | CRUD | R | R |

Scope enforcement (own field / own market) is done in service layer, not in `hasPermission`.

---

## Frontend Page Pattern
`src/app/(dashboard)/fields/page.tsx`

```ts
// Server Component — thin shell
export default async function FieldsPage() {
  return <FieldsClient />
}
```

`src/app/(dashboard)/fields/_components/fields-client.tsx`
```ts
'use client'
export function FieldsClient() {
  const { data, isLoading } = useQuery({
    queryKey: ['fields'],
    queryFn: () => fetch('/api/fields').then(r => r.json()),
  })
  // ...
}
```

---

## UI Pages → Route Map
| Page | Route |
|------|-------|
| Dashboard | `/dashboard` |
| Fields | `/fields` |
| Markets | `/markets` |
| Booths | `/booths` |
| Booth Categories | `/booth-categories` |
| Users | `/users` |
| Cameras | `/cameras` |
| Monitoring | `/monitoring` |
| Reports | `/reports` |
| Settings | `/settings` |

---

## Dashboard Widgets
Fetched from `GET /api/dashboard/stats` (TanStack Query, refetch every 60s).

| Widget | Color | Null for MARKET_MANAGER? |
|--------|-------|--------------------------|
| میادین (Fields) | blue | yes — shown as `—` |
| بازارها (Markets) | indigo | no |
| غرفه‌ها (Booths) | purple | no |
| دوربین‌ها (Total Cameras) | gray | no |
| دوربین آنلاین (Online) | green | no |
| دوربین آفلاین (Offline) | red | no |

## Reports Page Sections
Fetched from `GET /api/reports` (scope-filtered per role).

1. **Camera Status Summary** — 4 stat cards: Total / Online / Offline / Unknown
2. **Cameras per Field** — table; hidden for MARKET_MANAGER (empty array)
3. **Booths per Market** — table: Market · Field · Booth count

---

## Prisma Schema (final — `prisma/schema.prisma`)

Key decisions:
- All domain models have `deletedAt DateTime?` — soft delete only
- `User.username` is the login credential (not email)
- `UserScope` links users to specific Fields or Markets for FIELD_MANAGER / MARKET_MANAGER
- `Camera` can belong to a Field, Market, or Booth (nullable foreign keys)
- Prisma version pinned to **6.x** — do not upgrade to 7 (breaking datasource changes)

```prisma
enum Role        { ORG_ADMIN FIELD_MANAGER MARKET_MANAGER }
enum CameraStatus { ONLINE OFFLINE UNKNOWN }
enum ScopeType   { FIELD MARKET }
```

---

## Environment Variables

| Variable | Used by |
|----------|---------|
| `DATABASE_URL` | Prisma (`.env`) + Next.js (`.env.local`) — keep in sync |
| `AUTH_SECRET` | Auth.js — generate with `openssl rand -base64 32` |
| `AUTH_URL` | Auth.js — base URL of the app |
| `NEXT_PUBLIC_APP_URL` | Client-side absolute URLs |
