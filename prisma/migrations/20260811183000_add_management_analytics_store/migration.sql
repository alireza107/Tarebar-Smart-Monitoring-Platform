-- Analytics facts are deliberately separate from transactional Prisma models.
-- CV workers compact frame observations into one row/camera/minute before ingest.

CREATE TABLE analytics_camera_source (
  camera_id TEXT PRIMARY KEY,
  camera_name TEXT NOT NULL,
  field_id TEXT,
  field_name TEXT,
  market_id TEXT,
  market_name TEXT,
  booth_id TEXT,
  booth_name TEXT,
  expected_samples_per_minute INTEGER NOT NULL DEFAULT 30 CHECK (expected_samples_per_minute > 0),
  physically_calibrated BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics_camera_minute (
  camera_id TEXT NOT NULL REFERENCES analytics_camera_source(camera_id) ON DELETE CASCADE,
  bucket_start TIMESTAMPTZ NOT NULL,
  sample_count INTEGER NOT NULL CHECK (sample_count >= 0),
  expected_samples INTEGER NOT NULL CHECK (expected_samples > 0),
  confidence_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
  occupancy_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
  occupancy_max INTEGER,
  occupancy_last INTEGER,
  entries INTEGER NOT NULL DEFAULT 0,
  exits INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (camera_id, bucket_start)
);

CREATE INDEX analytics_camera_minute_bucket_brin ON analytics_camera_minute USING BRIN (bucket_start);
CREATE INDEX analytics_camera_minute_bucket_camera ON analytics_camera_minute (bucket_start, camera_id);

CREATE TABLE analytics_queue_minute (
  camera_id TEXT NOT NULL REFERENCES analytics_camera_source(camera_id) ON DELETE CASCADE,
  queue_id TEXT NOT NULL,
  queue_name TEXT NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  sample_count INTEGER NOT NULL CHECK (sample_count >= 0),
  length_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
  length_max INTEGER,
  length_last INTEGER,
  wait_sum_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  wait_sample_count INTEGER NOT NULL DEFAULT 0,
  throughput INTEGER NOT NULL DEFAULT 0,
  sla_met INTEGER NOT NULL DEFAULT 0,
  warning_samples INTEGER NOT NULL DEFAULT 0,
  critical_samples INTEGER NOT NULL DEFAULT 0,
  movement_speed_sum_mpm DOUBLE PRECISION NOT NULL DEFAULT 0,
  movement_speed_samples INTEGER NOT NULL DEFAULT 0,
  physically_calibrated BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (camera_id, queue_id, bucket_start)
);

CREATE INDEX analytics_queue_minute_bucket_brin ON analytics_queue_minute USING BRIN (bucket_start);
CREATE INDEX analytics_queue_minute_bucket_camera ON analytics_queue_minute (bucket_start, camera_id);

CREATE TABLE analytics_queue_wait_event (
  event_id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL REFERENCES analytics_camera_source(camera_id) ON DELETE CASCADE,
  queue_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  wait_seconds DOUBLE PRECISION NOT NULL CHECK (wait_seconds >= 0),
  sla_met BOOLEAN NOT NULL
);

CREATE INDEX analytics_queue_wait_event_lookup ON analytics_queue_wait_event (camera_id, queue_id, occurred_at);
CREATE INDEX analytics_queue_wait_event_time_brin ON analytics_queue_wait_event USING BRIN (occurred_at);

CREATE TABLE analytics_spatial_bucket (
  camera_id TEXT NOT NULL REFERENCES analytics_camera_source(camera_id) ON DELETE CASCADE,
  zone_id TEXT NOT NULL DEFAULT 'location',
  zone_name TEXT NOT NULL DEFAULT 'کل مکان',
  layer TEXT NOT NULL CHECK (layer IN ('occupancy', 'dwell', 'traffic', 'congestion')),
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_seconds INTEGER NOT NULL DEFAULT 900 CHECK (bucket_seconds >= 300),
  points JSONB NOT NULL,
  coverage_percent DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (camera_id, zone_id, layer, bucket_start)
);

CREATE INDEX analytics_spatial_bucket_time_brin ON analytics_spatial_bucket USING BRIN (bucket_start);
CREATE INDEX analytics_spatial_bucket_lookup ON analytics_spatial_bucket (camera_id, layer, bucket_start);

CREATE TABLE analytics_event (
  event_id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL REFERENCES analytics_camera_source(camera_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  title TEXT NOT NULL,
  metric_key TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  value DOUBLE PRECISION,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX analytics_event_time_brin ON analytics_event USING BRIN (occurred_at);
CREATE INDEX analytics_event_camera_time ON analytics_event (camera_id, occurred_at DESC);

CREATE TABLE analytics_location_hour (
  location_type TEXT NOT NULL CHECK (location_type IN ('field', 'market', 'booth')),
  location_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  parent_name TEXT,
  bucket_start TIMESTAMPTZ NOT NULL,
  sample_count BIGINT NOT NULL,
  expected_samples BIGINT NOT NULL,
  contributing_sources INTEGER NOT NULL,
  expected_sources INTEGER NOT NULL,
  confidence_sum DOUBLE PRECISION NOT NULL,
  occupancy_sum DOUBLE PRECISION NOT NULL,
  occupancy_max INTEGER,
  entries BIGINT NOT NULL,
  exits BIGINT NOT NULL,
  unique_visitors BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (location_type, location_id, bucket_start)
);

CREATE INDEX analytics_location_hour_time ON analytics_location_hour (bucket_start, location_type, location_id);

CREATE TABLE analytics_queue_location_hour (
  location_type TEXT NOT NULL CHECK (location_type IN ('field', 'market', 'booth')),
  location_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  parent_name TEXT,
  queue_id TEXT NOT NULL,
  queue_name TEXT NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  sample_count BIGINT NOT NULL,
  length_sum DOUBLE PRECISION NOT NULL,
  length_max INTEGER,
  wait_sum_seconds DOUBLE PRECISION NOT NULL,
  wait_sample_count BIGINT NOT NULL,
  throughput BIGINT NOT NULL,
  sla_met BIGINT NOT NULL,
  warning_samples BIGINT NOT NULL,
  critical_samples BIGINT NOT NULL,
  movement_speed_sum_mpm DOUBLE PRECISION NOT NULL,
  movement_speed_samples BIGINT NOT NULL,
  calibrated_sources INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (location_type, location_id, queue_id, bucket_start)
);

CREATE INDEX analytics_queue_location_hour_time ON analytics_queue_location_hour (bucket_start, location_type, location_id);

CREATE OR REPLACE FUNCTION analytics_sync_camera_sources() RETURNS void LANGUAGE sql AS $$
  INSERT INTO analytics_camera_source (
    camera_id, camera_name, field_id, field_name, market_id, market_name,
    booth_id, booth_name, enabled, updated_at
  )
  SELECT c.id, c.name,
         COALESCE(c."fieldId", m."fieldId", bm."fieldId"), COALESCE(f.name, mf.name, bmf.name),
         COALESCE(c."marketId", b."marketId"), COALESCE(m.name, bm.name),
         c."boothId", CASE WHEN b.id IS NULL THEN NULL ELSE 'غرفه ' || b.number END,
         c."deletedAt" IS NULL, now()
  FROM "Camera" c
  LEFT JOIN "Field" f ON f.id = c."fieldId"
  LEFT JOIN "Market" m ON m.id = c."marketId"
  LEFT JOIN "Field" mf ON mf.id = m."fieldId"
  LEFT JOIN "Booth" b ON b.id = c."boothId"
  LEFT JOIN "Market" bm ON bm.id = b."marketId"
  LEFT JOIN "Field" bmf ON bmf.id = bm."fieldId"
  ON CONFLICT (camera_id) DO UPDATE SET
    camera_name = EXCLUDED.camera_name, field_id = EXCLUDED.field_id,
    field_name = EXCLUDED.field_name, market_id = EXCLUDED.market_id,
    market_name = EXCLUDED.market_name, booth_id = EXCLUDED.booth_id,
    booth_name = EXCLUDED.booth_name, enabled = EXCLUDED.enabled, updated_at = now();
$$;

CREATE OR REPLACE FUNCTION analytics_refresh_location_rollups(refresh_from TIMESTAMPTZ, refresh_to TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(918273645) THEN RETURN FALSE; END IF;
  PERFORM analytics_sync_camera_sources();

  DELETE FROM analytics_location_hour WHERE bucket_start >= date_trunc('hour', refresh_from) AND bucket_start < refresh_to;
  INSERT INTO analytics_location_hour
  SELECT loc.location_type, loc.location_id, loc.location_name, loc.parent_name,
         date_trunc('hour', m.bucket_start), SUM(m.sample_count), SUM(m.expected_samples),
         COUNT(DISTINCT m.camera_id), COUNT(DISTINCT s.camera_id), SUM(m.confidence_sum),
         SUM(m.occupancy_sum), SUM(m.occupancy_max), SUM(m.entries), SUM(m.exits),
         CASE WHEN COUNT(DISTINCT m.camera_id) = 1 THEN MAX(m.unique_visitors) ELSE NULL END, now()
  FROM analytics_camera_minute m
  JOIN analytics_camera_source s ON s.camera_id = m.camera_id AND s.enabled
  CROSS JOIN LATERAL (VALUES
    ('field', s.field_id, s.field_name, NULL),
    ('market', s.market_id, s.market_name, s.field_name),
    ('booth', s.booth_id, s.booth_name, s.market_name)
  ) loc(location_type, location_id, location_name, parent_name)
  WHERE m.bucket_start >= date_trunc('hour', refresh_from) AND m.bucket_start < refresh_to AND loc.location_id IS NOT NULL
  GROUP BY loc.location_type, loc.location_id, loc.location_name, loc.parent_name, date_trunc('hour', m.bucket_start);

  DELETE FROM analytics_queue_location_hour WHERE bucket_start >= date_trunc('hour', refresh_from) AND bucket_start < refresh_to;
  INSERT INTO analytics_queue_location_hour
  SELECT loc.location_type, loc.location_id, loc.location_name, loc.parent_name,
         q.queue_id, q.queue_name, date_trunc('hour', q.bucket_start), SUM(q.sample_count),
         SUM(q.length_sum), SUM(q.length_max), SUM(q.wait_sum_seconds), SUM(q.wait_sample_count),
         SUM(q.throughput), SUM(q.sla_met), SUM(q.warning_samples), SUM(q.critical_samples),
         SUM(q.movement_speed_sum_mpm), SUM(q.movement_speed_samples),
         COUNT(DISTINCT q.camera_id) FILTER (WHERE q.physically_calibrated), now()
  FROM analytics_queue_minute q
  JOIN analytics_camera_source s ON s.camera_id = q.camera_id AND s.enabled
  CROSS JOIN LATERAL (VALUES
    ('field', s.field_id, s.field_name, NULL),
    ('market', s.market_id, s.market_name, s.field_name),
    ('booth', s.booth_id, s.booth_name, s.market_name)
  ) loc(location_type, location_id, location_name, parent_name)
  WHERE q.bucket_start >= date_trunc('hour', refresh_from) AND q.bucket_start < refresh_to AND loc.location_id IS NOT NULL
  GROUP BY loc.location_type, loc.location_id, loc.location_name, loc.parent_name,
           q.queue_id, q.queue_name, date_trunc('hour', q.bucket_start);
  RETURN TRUE;
END;
$$;
