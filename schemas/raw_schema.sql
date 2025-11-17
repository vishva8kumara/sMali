
CREATE DATABASE raw;

-- Raw server metrics table
CREATE TABLE IF NOT EXISTS raw.metrics (
    id BIGSERIAL PRIMARY KEY,
    server_id TEXT NOT NULL,
    metric_type TEXT NOT NULL,     -- cpu | memory | disk_io | net_io
    metric_value DOUBLE PRECISION NOT NULL,
    ts TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_raw_metrics_ts 
    ON raw.metrics (ts DESC);
