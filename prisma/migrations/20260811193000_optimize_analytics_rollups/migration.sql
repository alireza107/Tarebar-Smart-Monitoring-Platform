-- Correct location occupancy semantics: each camera is averaged within the hour,
-- then camera averages are summed so additional cameras do not dilute occupancy.
CREATE OR REPLACE FUNCTION analytics_refresh_location_rollups(refresh_from TIMESTAMPTZ, refresh_to TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(918273645) THEN RETURN FALSE; END IF;
  PERFORM analytics_sync_camera_sources();

  DELETE FROM analytics_location_hour WHERE bucket_start >= date_trunc('hour', refresh_from) AND bucket_start < refresh_to;
  INSERT INTO analytics_location_hour
  WITH camera_hour AS (
    SELECT m.camera_id, date_trunc('hour', m.bucket_start) bucket_start,
           SUM(m.sample_count) sample_count, SUM(m.expected_samples) expected_samples,
           SUM(m.confidence_sum) confidence_sum,
           SUM(m.occupancy_sum)/NULLIF(SUM(m.sample_count),0) occupancy_average,
           MAX(m.occupancy_max) occupancy_max, SUM(m.entries) entries, SUM(m.exits) exits,
           MAX(m.unique_visitors) unique_visitors
    FROM analytics_camera_minute m
    WHERE m.bucket_start >= date_trunc('hour', refresh_from) AND m.bucket_start < refresh_to
    GROUP BY m.camera_id, date_trunc('hour', m.bucket_start)
  )
  SELECT loc.location_type, loc.location_id, loc.location_name, loc.parent_name,
         c.bucket_start, SUM(c.sample_count), SUM(c.expected_samples),
         COUNT(DISTINCT c.camera_id), COUNT(DISTINCT s.camera_id), SUM(c.confidence_sum),
         SUM(c.occupancy_average), SUM(c.occupancy_max), SUM(c.entries), SUM(c.exits),
         CASE WHEN COUNT(DISTINCT c.camera_id) = 1 THEN MAX(c.unique_visitors) ELSE NULL END, now()
  FROM camera_hour c
  JOIN analytics_camera_source s ON s.camera_id = c.camera_id AND s.enabled
  CROSS JOIN LATERAL (VALUES
    ('field', s.field_id, s.field_name, NULL),
    ('market', s.market_id, s.market_name, s.field_name),
    ('booth', s.booth_id, s.booth_name, s.market_name)
  ) loc(location_type, location_id, location_name, parent_name)
  WHERE loc.location_id IS NOT NULL
  GROUP BY loc.location_type, loc.location_id, loc.location_name, loc.parent_name, c.bucket_start;

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

-- Small, repeatable deletes avoid long locks. At the target rate the default
-- batch is larger than one minute of expired camera facts.
CREATE OR REPLACE FUNCTION analytics_purge_expired(batch_size INTEGER DEFAULT 10000)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM analytics_camera_minute WHERE ctid IN
    (SELECT ctid FROM analytics_camera_minute WHERE bucket_start < now()-interval '14 days' LIMIT batch_size);
  DELETE FROM analytics_queue_minute WHERE ctid IN
    (SELECT ctid FROM analytics_queue_minute WHERE bucket_start < now()-interval '30 days' LIMIT batch_size);
  DELETE FROM analytics_spatial_bucket WHERE ctid IN
    (SELECT ctid FROM analytics_spatial_bucket WHERE bucket_start < now()-interval '30 days' LIMIT batch_size);
  DELETE FROM analytics_queue_wait_event WHERE ctid IN
    (SELECT ctid FROM analytics_queue_wait_event WHERE occurred_at < now()-interval '180 days' LIMIT batch_size);
  DELETE FROM analytics_event WHERE ctid IN
    (SELECT ctid FROM analytics_event WHERE occurred_at < now()-interval '180 days' LIMIT batch_size);
  DELETE FROM analytics_location_hour WHERE bucket_start < now()-interval '2 years';
  DELETE FROM analytics_queue_location_hour WHERE bucket_start < now()-interval '2 years';
END;
$$;
