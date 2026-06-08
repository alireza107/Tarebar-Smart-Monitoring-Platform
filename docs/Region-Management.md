# Region Management Module — Technical Design

> Scope: **Region Management & Stall Mapping foundations only.**
> Explicitly **out of scope**: AI analytics, people counting, density, heatmaps,
> reporting, dashboards, KPI aggregation, AI models. None of those are designed,
> referenced, or stubbed here.

## 0. Terminology mapping to the existing platform

The product brief uses the term **Stall** (Vendor / Shop / Business Unit). In this
codebase that entity already exists as **`Booth`** (`غرفه`). This module integrates
with the existing `Booth` entity — **Stall ≡ Booth** — and does **not** introduce a
parallel "Stall" model. The existing hierarchy `Field → Market → Booth` is reused as
`Field → Market → Stall`.

A **Region** is anchored to a **Market** (a region is "a logical/physical area inside
a market"). This anchoring is what lets the module reuse the platform's existing
RBAC + scope enforcement unchanged.

---

## 1. Domain Model

| Entity | Purpose | Geometry? |
| --- | --- | --- |
| **Region** | A user-defined, arbitrarily-named spatial area inside a Market. | No |
| **CameraRegion** | The `Camera ↔ Region` edge. Stores how **one camera** sees **one region**: its main polygon + exclusion polygons. | **Yes** |
| **RegionBooth** | The `Region ↔ Booth (Stall)` edge. Pure association. | No |
| **AuditLog** | Append-only trail of region/mapping mutations. | No |

Key invariants from the brief, and how they are realized:

- *"A Region is not tied to a single camera"* → Region has **no** `cameraId`, no geometry.
- *"A Region can be visible in multiple cameras; a camera can see multiple regions"* →
  `Camera ⟷ Region` is **many-to-many** via `CameraRegion`.
- *"Each camera may define a different polygon for the same region"* → geometry lives on
  the **`CameraRegion` edge**, not on `Region`.
- *"EffectiveArea = MainPolygon − ExclusionPolygons"* → each `CameraRegion` stores a
  `mainPolygon` and an array of `exclusionPolygons`.
- *"Region ⟷ Stall is many-to-many and unrestricted"* → `RegionBooth` join, no market
  constraint enforced on stall links.

---

## 2. Entity Relationships (ERD)

```
Field 1───* Market 1───* Booth(=Stall)
                │              │
                │ 1            │ *
                │              │
                *          RegionBooth   (M:N, soft-delete)
              Region ─────────┘ *
                │ 1
                │
                * CameraRegion  (M:N edge, owns geometry, soft-delete)
                │ *
                │ 1
              Camera *───1 (Field | Market | Booth)   [existing]
```

- `Region.marketId → Market.id` (a region belongs to exactly one market).
- `CameraRegion (cameraId, regionId)` unique; geometry on the edge.
- `RegionBooth (regionId, boothId)` unique.
- All three region tables use **soft delete** (`deletedAt`).

---

## 3. Database Schema (Prisma)

Added to `prisma/schema.prisma` (migration: `20260608120000_add_region_management`):

```prisma
enum AuditAction { CREATE UPDATE DELETE RESTORE IMPORT EXPORT }

model Region {
  id          String    @id @default(cuid())
  name        String
  description String?
  marketId    String
  color       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  market        Market         @relation(fields: [marketId], references: [id])
  cameraRegions CameraRegion[]
  booths        RegionBooth[]
  @@unique([marketId, name])      // unique region name per market
  @@index([marketId])
}

model CameraRegion {
  id                String    @id @default(cuid())
  cameraId          String
  regionId          String
  mainPolygon       Json                      // Point[]      normalized [0,1]
  exclusionPolygons Json      @default("[]")  // Point[][]    normalized [0,1]
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?
  camera Camera @relation(fields: [cameraId], references: [id])
  region Region @relation(fields: [regionId], references: [id])
  @@unique([cameraId, regionId])
  @@index([regionId]); @@index([cameraId])
}

model RegionBooth {
  id        String    @id @default(cuid())
  regionId  String
  boothId   String
  createdAt DateTime  @default(now())
  deletedAt DateTime?
  region Region @relation(fields: [regionId], references: [id])
  booth  Booth  @relation(fields: [boothId], references: [id])
  @@unique([regionId, boothId])
  @@index([regionId]); @@index([boothId])
}

model AuditLog {
  id String @id @default(cuid())
  actorId String?  actorName String?
  action AuditAction
  entityType String  entityId String
  marketId String?  metadata Json?
  createdAt DateTime @default(now())
  @@index([entityType, entityId]); @@index([marketId]); @@index([createdAt])
}
```

### Geometry representation

- Coordinates are **normalized floats in `[0,1]`** relative to the camera frame
  (origin top-left). Resolution-independent: the same polygon renders correctly at any
  stream/display size.
- `Point = { x: number, y: number }`, `Polygon = Point[]` (ring, min 3, implicitly
  closed), `exclusionPolygons = Polygon[]`.
- Stored as JSON columns (`Json`/`JSONB`) — flexible, no extra tables, and the geometry
  is always read/written as a whole unit (no per-vertex querying needed).

---

## 4. API Endpoints

Base: `/api/regions`. All responses wrap data as `{ data }`; errors as
`{ error, code }`. Auth required on every route.

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/regions?q=&marketId=` | `region:read` | List regions in scope; `q` searches name+description, `marketId` filters. |
| `POST` | `/api/regions` | `region:create` | Create a region. |
| `GET` | `/api/regions/:id` | `region:read` | Region detail incl. camera mappings + booth links. |
| `PATCH` | `/api/regions/:id` | `region:update` | Update name/description/color (market is immutable). |
| `DELETE` | `/api/regions/:id` | `region:delete` | Soft-delete region + cascade soft-delete its mappings. |
| `GET` | `/api/regions/:id/cameras` | `region:read` | List camera mappings. |
| `POST` | `/api/regions/:id/cameras` | `region:update` | Add a camera mapping (camera + polygon + exclusions). |
| `PATCH` | `/api/regions/:id/cameras/:mappingId` | `region:update` | Update a mapping's geometry. |
| `DELETE` | `/api/regions/:id/cameras/:mappingId` | `region:update` | Remove a camera mapping. |
| `GET` | `/api/regions/:id/stalls` | `region:read` | List booths (stalls) linked to the region. |
| `PUT` | `/api/regions/:id/stalls` | `region:update` | Replace the full set of linked booths (`{ boothIds }`). |
| `GET` | `/api/regions/export` | `region:read` | Download all in-scope regions as JSON. |
| `POST` | `/api/regions/import` | `region:create` | Upsert regions by `(marketId, name)`. |

Status codes: `201` create, `204` delete, `401` unauthenticated, `403`
permission/scope, `404` not found, `409` conflict (duplicate name/mapping), `422`
validation, `400` business-rule (e.g. cross-market camera).

---

## 5. Backend Architecture

Follows the platform's existing **module layering** (`route → service → repository`):

```
src/app/api/regions/**            Route handlers (auth, permission, scope, zod, HTTP mapping)
src/modules/region/
  ├─ schema.ts        Zod DTOs (region, camera mapping, stall mapping, import/query)
  ├─ geometry.ts      Point/Polygon Zod schemas + pure geometry helpers
  ├─ types.ts         Read-model TS types (RegionSummary, RegionDetail, …)
  ├─ repository.ts    Prisma data access (incl. soft-delete cascade & set-diff)
  ├─ service.ts       Business rules, validation, audit, import/export
  └─ http.ts          Error → HTTP response mapper
src/lib/
  ├─ permissions.ts   + 'region' resource in the RBAC matrix
  ├─ scope-guard.ts   + assertRegionScope() (= market scope)
  └─ audit.ts         Generic, best-effort audit writer (new)
```

- **Validation**: every input parsed with Zod before touching the DB (geometry included —
  coordinate bounds, min vertices, self-intersection).
- **Soft delete**: deleting a region cascades to soft-delete its `CameraRegion` and
  `RegionBooth` rows in a single transaction.
- **Stall set update** uses set-diff semantics with soft-delete reuse: removed links are
  soft-deleted, re-added links restore the existing row (no churn / unique-constraint
  collisions).
- **Audit logging** is best-effort (never breaks the originating mutation) and records
  actor, action, entity, market, and a before/after (or diff) snapshot.

---

## 6. Frontend Architecture

```
src/app/(dashboard)/regions/
  ├─ page.tsx
  └─ _components/
       ├─ regions-client.tsx        List + search + CRUD + import/export
       ├─ region-form.tsx           Create/edit (RHF + Zod)
       ├─ region-detail-dialog.tsx  Tabs: Camera mapping | Stall mapping
       ├─ camera-mapping-panel.tsx  Manage a region's camera mappings
       ├─ polygon-editor.tsx        SVG polygon + exclusion editor
       └─ stall-mapping-panel.tsx   Multi-select booths (stalls)
```

- **TanStack Query** for all fetching/mutations; **React Hook Form + Zod** for forms;
  **shadcn/ui** + Tailwind; toasts via `sonner`. Mirrors the existing Camera module.
- **Polygon editor** (`polygon-editor.tsx`): click to add vertices, drag to move,
  switch between the main ring and any number of exclusion rings, live effective-area
  readout. Outputs normalized `[0,1]` coordinates. Optional camera-snapshot background.

### Key user flows

1. **Create region** → name + market (+ optional description/color) → appears in list.
2. **Map a camera** → Manage → *Camera mapping* tab → pick a camera → draw main polygon
   → optionally add exclusion polygons → Save. Repeat per camera (each gets its own
   polygon for the same region).
3. **Overlap removal** → on an overlapping camera view, add exclusion polygons so
   `EffectiveArea = main − exclusions`.
4. **Map stalls** → Manage → *Stall mapping* tab → check booths → Save (replace-set).
5. **Search** → type in the search box (server-side `q` filter).
6. **Import/Export** → Export downloads JSON; Import upserts by `(marketId, name)`.

---

## 7. Validation Rules

**Region**
- `name`: required, ≤100 chars; **unique per market** (case-insensitive).
- `marketId`: required, must exist & be in the user's scope; **immutable** after create.
- `description` ≤500; `color` optional `#RRGGBB`.

**Camera mapping (geometry)**
- `mainPolygon`: 3–200 vertices; every coord in `[0,1]`; **simple** (no self-intersection).
- `exclusionPolygons`: ≤50 rings, each a valid simple polygon.
- One mapping per `(camera, region)` (duplicate → `409`).
- A camera **assigned to a different market** cannot map the region (`400`). Field-level /
  unassigned cameras are allowed (flexible multi-market coverage).

**Stall mapping**
- `boothIds` must reference existing booths; otherwise `400`.
- **No market restriction** — per the brief, business users decide mappings freely.

---

## 8. Permission Matrix (`region` resource)

| Role | create | read | update | delete | Scope |
| --- | :---: | :---: | :---: | :---: | --- |
| **ORG_ADMIN** | ✅ | ✅ | ✅ | ✅ | All markets |
| **FIELD_MANAGER** | ✅ | ✅ | ✅ | ✅ | Markets within assigned field(s) |
| **MARKET_MANAGER** | ✅ | ✅ | ✅ | ✅ | Assigned market(s) only |

Two-layer enforcement on every mutation: `checkPermission(region, action)` (RBAC) **then**
`assertRegionScope(marketId)` (row-level scope, delegated to the existing
`assertMarketScope`). Read/list is automatically scope-filtered to the caller's markets.

---

## 9. Technical Design Decisions

1. **Stall ≡ Booth.** Reuse the existing entity instead of adding a duplicate model —
   avoids divergence and reuses existing scope logic. (DRY/YAGNI.)
2. **Region anchored to Market.** Gives free, consistent RBAC/scope and a natural home in
   the hierarchy, without constraining camera or stall relationships.
3. **Geometry on the edge, not the Region.** Directly models "same region, different
   polygon per camera" and keeps `Region` a pure logical concept.
4. **Normalized `[0,1]` coordinates.** Resolution-independent; survives camera/stream
   resolution changes; trivial to render in SVG.
5. **JSON polygon storage.** Geometry is always read/written whole; no need for a vertex
   table or spatial queries in this scope (no PostGIS dependency).
6. **Exclusions as separate rings (`main − exclusions`).** Matches the brief's manual
   overlap-removal requirement without boolean-geometry libraries server-side.
7. **Soft delete everywhere + cascade.** Consistent with the platform rule; deleting a
   region tidies its edges but is reversible at the data layer.
8. **Set-diff stall updates.** Idempotent `PUT` of the desired booth set; reuses
   soft-deleted rows on re-add to avoid unique-constraint churn.
9. **Generic AuditLog.** A single append-only table serves all region entities and is
   reusable by other modules later; writes are best-effort.
10. **Import upsert by `(marketId, name)`.** Export → edit → re-import round-trips
    cleanly and is safe to re-run.

---

## 10. Setup / Migration

The Prisma client must be regenerated and the migration applied (stop `next dev` first so
the query-engine DLL is not locked on Windows):

```bash
npx prisma generate
npx prisma migrate dev          # applies 20260608120000_add_region_management
# or, against an existing DB:  npx prisma migrate deploy
```
