
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Raw server metrics table
CREATE TABLE IF NOT EXISTS raw.metrics (
    id BIGSERIAL PRIMARY KEY,
    server_id TEXT NOT NULL,
    metric_type TEXT NOT NULL,     -- cpu | memory | disk_io | net_io
    metric_value DOUBLE PRECISION NOT NULL,
    ts TIMESTAMPTZ NOT NULL
);

-- Stores aggregated metrics
CREATE TABLE IF NOT EXISTS analytics.aggregated_metrics (
    id SERIAL PRIMARY KEY,
    server_id TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    avg_value NUMERIC,
    min_value NUMERIC,
    max_value NUMERIC,
    p90_value NUMERIC
);

CREATE TABLE IF NOT EXISTS analytics.run_state (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE,
    last_processed_ts TIMESTAMPTZ
);
INSERT INTO analytics.aggregation_run_state (last_processed_ts, interval_minutes)
VALUES ('1970-01-01', 5);

