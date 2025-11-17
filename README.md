# Server Metrics Aggregation & LLM Insights

This project demonstrates a complete analytics pipeline for processing high-frequency server metrics into time-series summaries, storing them in an OLAP database, and generating insights using an LLM.

It includes:

* Raw metrics ingestion
* Time-binned aggregation
* Dual-database architecture
* Automated or on-demand batch processing
* REST API for metrics + AI insights
* Fully containerized microservices

---

## System Architecture

```
Seeder -> Raw DB -> Aggregator -> Analytics DB -> API -> LLM Insights
```

### Components

* **Seeder**: Generates realistic synthetic server metrics (CPU, memory, IO, network) with random anomalies.
* **Raw DB (OLTP)**: Stores unprocessed high-frequency metrics.
* **Aggregator**: Groups metrics into configurable time bins (e.g., 1 min) and computes statistics:

  * avg, min, max
  * p80 (or p90 depending on volume)
* **Analytics DB (OLAP)**: Stores aggregated metrics optimized for querying.
* **API Service**: Provides time-series data and feeds it to an LLM.
* **LLM**: Produces anomaly summaries, trend analysis, and server-health insights.

---

## Running the System

### 1. Seed data

```bash
docker compose up --build seeder
```

### 2. Run the aggregator once (demo mode)

```bash
docker compose run aggregator node aggregator.js once
```

### 3. Start full system

```bash
docker compose up --build
```

---

## Environment Variables

Each service includes a `.env.example`.
Copy it to `.env` and adjust based on your setup.

Example:

```
cp seeder/.env.example seeder/.env
cp aggregator/.env.example aggregator/.env
cp api/.env.example api/.env
```

---

## Project Structure

```
root/
 ├── seeder/        # synthetic metric generator
 ├── aggregator/    # batch processor (loop or one-shot)
 ├── api/           # REST API + LLM integration
 └── docker-compose.yml
```

---

## Aggregation Logic

Metrics are grouped into time bins using a UTC-safe method to avoid timezone drift.

For each (server_id, metric_type, time_bin), the aggregator computes:

* average value
* minimum value
* maximum value
* p80 percentile (to reduce noise on small samples)

Aggregated results look like:

```
{
  "server_id": "srv-1",
  "metric_type": "cpu",
  "ts": "2025-11-15T20:20:00.000Z",
  "avg": 67.3,
  "min": 65.1,
  "max": 70.4,
  "p80": 69.8
}
```

---

## LLM Insights

The API can provide:

* Server anomaly detection
* Trend summaries
* Comparative analysis between servers
* Resource usage forecasting

The API supports two modes:

* **OpenAI mode**: Real LLM calls
* **Mock mode**: Local predictable responses (offline testing)

Lists periods with data availble
 http://localhost:3000/periods

Analyze all servers for a given period
 http://localhost:3000/insights?start=2025-11-15T10:00:00&end=2025-11-16T10:00:00

Analyze one server for a given period
 http://localhost:3000/insights?start=2025-11-15T10:00:00&end=2025-11-16T10:00:00&server=srv-2

---

## Notes

* Aggregator uses *time-binning in UTC* to prevent daylight-offset errors.
* Dual-DB design prevents locking production-grade raw metrics.
* "Loop mode" allows scheduled aggregation (e.g., every 5 minutes).
* "Once mode" is recommended for demos and testing.

