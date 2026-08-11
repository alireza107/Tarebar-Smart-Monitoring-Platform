# Management Analytics — Phase 1 contract

## Location hierarchy

The management hierarchy reuses the operational domain model:

`Organization → Field (میدان) → Market (بازار) → Booth/area (غرفه) → Region/zone → Camera`

Management analytics may be grouped only by `field`, `market`, or `booth`. Regions and cameras are operational leaves and are never KPI dimensions on management pages.

## Dashboard endpoints

- `GET /api/management/locations` returns the authenticated user's compact, scope-filtered hierarchy. It includes zone/camera counts but does not return camera records, keeping the global-filter payload bounded for roughly 2,000 cameras.
- `GET /api/management/overview` accepts `locationType`, optional `locationId`, `placeType`, `from`, `to`, `comparison`, and optional `timeFrom`/`timeTo`.

The Next.js API validates filters, checks existing RBAC scope, then requests:

`GET {VIDEO_ANALYTICS_API_URL}/api/v1/management/overview`

The upstream response should match `ManagementOverview` in `src/modules/management-analytics/types.ts`. Until the analytics store implements this endpoint, the service returns a typed `dataStatus: "unavailable"` response and the UI renders explicit empty states rather than sample data.

## Scale assumptions

- Frame inference (about 0.5 FPS per camera) remains outside the transactional PostgreSQL database.
- The analytics backend should persist minute/hour rollups keyed by location and metric, with raw events retained separately.
- Dashboard requests read rollups for one authorized location subtree; they must not fan out to cameras at request time.
- Spatial outputs are pre-aggregated heat points in a location coordinate system, not per-frame or per-camera detections.
