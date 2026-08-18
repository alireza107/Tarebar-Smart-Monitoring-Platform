# Scalable analytics backend

## Capacity model

At 2,000 cameras and 0.5 processed frames per second, the fleet produces roughly:

- 1,000 inference observations/second
- 60,000 observations/minute
- 86.4 million observations/day

Those observations must not become dashboard rows or synchronous HTTP calls. The implemented
producer compacts them into at most one camera-minute fact per camera: about 33 writes/second and
2.88 million compact facts/day before retention. Dashboard reads use location-hour rollups, not
camera-minute facts.

## Implemented data path

```text
Connected cameras (0.5 FPS fleet) → detector/tracker → camera-local minute accumulator
            → atomic disk outbox → authenticated batch ingest API
            → PostgreSQL compact facts → advisory-locked incremental rollup
            → field/market/booth hour read models → Next.js scoped API → dashboard

On-demand live/video jobs remain a separate path and still write annotated previews.
```

The fleet sampler (`VIDEO_ANALYTICS_FLEET_ENABLED`) keeps one worker per connected camera,
grabs **one frame every two seconds**, and never writes dashboard job videos. Queue, crowd,
and heatmap facts are rolled up by the camera's field/market/booth. On-demand Live Analytics
and recorded Video Analytics are unchanged.

Properties:

- Frame processing continues when PostgreSQL or the ingest API is unavailable.
- The outbox retries delivery and is bounded per camera. After the configured outage window,
  oldest facts are discarded to protect the worker disk; coverage exposes the resulting gap.
- Ingestion is idempotent. Duplicate minute batches replace the same camera/bucket fact and event
  identifiers are deduplicated.
- Request payloads are bounded to 500 camera-minutes, 100 queues/camera, 500 events/camera-minute,
  and 256 points/spatial layer.
- A fixed PostgreSQL pool prevents every request or camera from opening a connection.
- One replica refreshes recent hour rollups at a time using a transaction-scoped advisory lock.
- Retention runs in small batches: camera facts 3 days, queue facts 7 days, spatial facts 14 days, events/waits
  180 days, and location-hour facts two years.
- Camera/location dimensions are synchronized from the transactional model, but cameras never
  appear as management KPI dimensions.

## Production topology for 2,000 cameras

The repository's current `JobManager` is an MVP controller and must not run all 2,000 streams in
one process. Use separate roles:

1. A stateless control API accepts configuration and desired stream state.
2. A durable scheduler assigns cameras to inference workers using leases and heartbeats.
3. GPU/CPU inference workers each own a bounded number of streams based on measured decode,
   inference, VRAM, and network capacity. Share decoding/detection once between enabled analytics.
4. The ingest API scales horizontally behind a load balancer.
5. PostgreSQL stores compact facts and read models. At larger retention/query volumes, move this
   schema to a dedicated PostgreSQL/TimescaleDB cluster and use native time partitions.
6. A message broker (Kafka/Redpanda/NATS JetStream) can replace direct HTTP between worker outboxes
   and consumers when replay, multiple consumers, or sustained burst absorption is required.

## Topics that determine uninterrupted operation

### Backpressure and failure isolation

Every boundary needs a maximum queue, timeout, retry budget, and overload behavior. Camera failure,
model failure, ingest failure, and dashboard failure must be isolated. Never allow slow database
writes to block decode/inference. Prefer at-least-once delivery plus idempotent writes over trying
to build distributed exactly-once processing.

### Data correctness

- Store timestamps in UTC and apply the business timezone only when grouping/filtering.
- Version camera geometry, calibration, spatial grids, models, and metric definitions.
- Publish multi-camera spatial grids only after every contributing camera is surveyed into the
  same location coordinate system. The built-in producer therefore emits management grids only
  from calibrated ground heatmaps; uncalibrated image grids stay camera-local.
- Do not sum overlapping camera views without overlap reconciliation.
- Unique visitors across cameras require a privacy-reviewed cross-camera reconciliation service;
  otherwise return unavailable, as the current contract does.
- Physical queue speed must remain null without valid metre calibration.
- Keep coverage and confidence beside every aggregate so missing cameras cannot look like reduced
  business activity.

### Database design

- Keep OLTP entities and analytical facts logically separate; dedicated clusters are preferable at
  sustained production volume.
- Use BRIN/time indexes for append-oriented facts and B-tree indexes for location/time lookups.
- Maintain short raw/compact retention and long rollup retention.
- For production beyond tens of millions of hot rows, use daily native partitions or TimescaleDB
  hypertables and drop expired partitions rather than deleting individual rows.
- Put PgBouncer in transaction mode ahead of PostgreSQL when API/worker replica counts grow.
- Set statement, lock, and idle-transaction timeouts; monitor vacuum lag, WAL volume, replication
  lag, cache hit rate, connection saturation, and slow queries.

### High availability and deployments

- Run at least two control/read API replicas across failure domains.
- Use PostgreSQL primary plus synchronous/managed standby and tested point-in-time recovery.
- Use readiness probes that include required dependencies and liveness probes that only test the
  process. A degraded analytics store should not restart healthy inference workers.
- Apply expand/migrate/contract database changes. Deploy backward-compatible consumers before
  producers and use canary/rolling updates with connection draining.
- Persist scheduler leases and make worker assignment fencing-token based so two workers cannot own
  one stream after a network partition.

### Observability and service objectives

Track at minimum:

- configured, assigned, connected, decoding, and contributing camera counts
- end-to-end observation lag and rollup freshness
- ingest accepted/retried/dropped facts and outbox age/size
- per-stage FPS, decode failures, inference latency, GPU utilization, and tracker resets
- API p50/p95/p99 latency and error rate
- database pool wait time, query latency, deadlocks, vacuum/WAL/replication lag
- coverage/confidence by field and market

Define alerts from service objectives—for example, 99.9% read availability, p95 dashboard response
under two seconds, rollups under three minutes old, and no unacknowledged outbox older than five
minutes—rather than alerting on raw CPU alone.

### Security and multi-tenancy

- Keep ingest and read keys separate, rotate them, and use mTLS or workload identity in production.
- Do not expose the analytics service directly to browsers; the Next.js API performs RBAC and
  location scope checks.
- Rate-limit service keys, bound all requests, encrypt storage/backups, and audit administrative
  changes to geometry, calibration, thresholds, and retention.
- Include organization ID in facts before supporting multiple organizations in one analytics
  cluster, and enforce it in database policies or dedicated schemas—not only in UI filters.

### Capacity and recovery testing

Before production, replay synthetic compact facts at 2–3× expected peak, run dashboards
concurrently, disconnect PostgreSQL, fill/recover outboxes, kill workers, fail over the database,
and restore a backup into an isolated environment. Capacity numbers should come from those tests,
not camera count alone.
