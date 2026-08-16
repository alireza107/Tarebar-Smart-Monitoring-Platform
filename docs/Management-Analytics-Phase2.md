# Management Analytics — Phase 2 contract

Phase 2 adds video-free analytical modules for the business hierarchy:

`Field (میدان) → Market (بازار) → Booth (غرفه)`

Regions may appear as spatial zones and queues may appear as service units, but cameras are
only contributing sources. Camera IDs and raw frames are intentionally absent from all module
responses.

## Endpoints

All endpoints accept the Phase 1 global filters plus `bucket=hour|day`, apply the existing
RBAC/location-scope check, and proxy the equivalent aggregation endpoint on
`VIDEO_ANALYTICS_API_URL`.

- `GET /api/management/people-flow` → upstream `/api/v1/management/people-flow`
- `GET /api/management/queues` → upstream `/api/v1/management/queues`
- `GET /api/management/spatial` → upstream `/api/v1/management/spatial`

The upstream FastAPI service now implements compact authenticated ingestion, PostgreSQL facts,
incremental location rollups, and all three read endpoints. If that store is missing, unavailable,
or returns an invalid top-level shape, each route
returns its complete typed contract with `dataStatus: "unavailable"`, null metrics, and empty
series. The UI never substitutes sample values.

The TypeScript response contracts are `PeopleFlowAnalytics`, `QueueAnalytics`, and
`SpatialAnalytics` in `src/modules/management-analytics/types.ts`.

## Aggregation rules

- Requests read rollups for one authorized location subtree; they must not fan out to cameras.
- Time series use precomputed hour/day buckets. Current occupancy may come from the latest valid
  minute rollup, but not from a frame query.
- Unique visitors are returned only where identity reconciliation is valid for the selected
  location and period. Otherwise `uniqueVisitorsAggregation` is `not_available`.
- Queue movement speed is null unless at least one physically calibrated source contributes;
  `isPhysicallyCalibrated` is also exposed per queue.
- Spatial layers use normalized location coordinates (`0..100`) and pre-aggregated points.
  `periodA`, `periodB`, and `difference` must use matching grids and bucket definitions.
- `dataQuality` reports expected/contributing sources, coverage, confidence, and calibrated-source
  count. Partially offline sources therefore reduce quality instead of silently producing a full
  confidence KPI.
- Related events are bounded references, not raw detections, and support the shared drill-down
  path: KPI → trend → comparison → location → time period → event.

## Analytical-store keys

For roughly 2,000 cameras, rollups are keyed by:

`organization_id, location_type, location_id, metric_family, bucket_start, bucket_size`

Spatial rollups additionally include `zone_id, grid_version, cell_x, cell_y`; queue rollups include
`queue_id` and `calibration_version`. Keep raw events in a separate retention tier and join only
bounded event references into dashboard responses.

## Phase 3 foundation

Phase 3 can build alerts/events, cross-location benchmarking, scheduled reports, exports, and
forecast/capacity recommendations on these same bucketed metrics and quality fields. It should
preserve scope checks, make low-coverage intervals explicit, and link operational investigation
to live tools without adding video to management analytics pages.
