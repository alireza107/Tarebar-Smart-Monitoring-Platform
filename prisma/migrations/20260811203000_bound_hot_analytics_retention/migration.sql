-- Keep hot fact tables bounded for the 2,000-camera target. Durable hour
-- rollups retain history, so frame-adjacent facts can have short retention.
CREATE OR REPLACE FUNCTION analytics_purge_expired(batch_size INTEGER DEFAULT 10000)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM analytics_camera_minute WHERE ctid IN
    (SELECT ctid FROM analytics_camera_minute WHERE bucket_start < now()-interval '3 days' LIMIT batch_size);
  DELETE FROM analytics_queue_minute WHERE ctid IN
    (SELECT ctid FROM analytics_queue_minute WHERE bucket_start < now()-interval '7 days' LIMIT batch_size);
  DELETE FROM analytics_spatial_bucket WHERE ctid IN
    (SELECT ctid FROM analytics_spatial_bucket WHERE bucket_start < now()-interval '14 days' LIMIT batch_size);
  DELETE FROM analytics_queue_wait_event WHERE ctid IN
    (SELECT ctid FROM analytics_queue_wait_event WHERE occurred_at < now()-interval '180 days' LIMIT batch_size);
  DELETE FROM analytics_event WHERE ctid IN
    (SELECT ctid FROM analytics_event WHERE occurred_at < now()-interval '180 days' LIMIT batch_size);
  DELETE FROM analytics_location_hour WHERE bucket_start < now()-interval '2 years';
  DELETE FROM analytics_queue_location_hour WHERE bucket_start < now()-interval '2 years';
END;
$$;
