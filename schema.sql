
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

-- -----------------

CREATE DATABASE analytics;

-- Stores aggregated metrics
CREATE TABLE IF NOT EXISTS analytics.aggregated_metrics (
    id SERIAL PRIMARY KEY,
    server_id TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    avg_value NUMERIC,
    min_value NUMERIC,
    max_value NUMERIC,
    p90_value NUMERIC,
    p80_value NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_aggregated_metrics_ts 
    ON analytics.aggregated_metrics (ts DESC);
CREATE INDEX IF NOT EXISTS idx_aggregated_metrics_server_ts
    ON analytics.aggregated_metrics (server_id, ts DESC);
-- CREATE INDEX IF NOT EXISTS idx_aggregated_metrics_metric_ts
--     ON analytics.aggregated_metrics (metric_type, ts DESC);

CREATE TABLE IF NOT EXISTS analytics.run_state (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE,
    last_processed_ts TIMESTAMPTZ
);
INSERT INTO analytics.run_state (id, last_processed_ts)
VALUES (TRUE, '1970-01-01');

