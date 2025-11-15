# Server Metrics Aggregation & LLM Insights

This project implements a mini analytics platform consisting of:

- Raw metrics database
- Aggregation pipeline
- Analytics database
- LLM-based insights API

The system demonstrates:
- Batch-processing pipelines
- Dual-database architecture (OLTP + OLAP)
- Scheduled aggregation (loop mode)
- On-demand aggregation (demo mode)
- Containerized modular microservice layout

---

## Architecture

Seeder (for demo) ──► [ Raw DB ] ──► Aggregator ──► [ Analytics DB ] ──► API with LLM Insights

### Components:
- **Seeder** — populates raw metrics with realistic server anomalies.
- **Aggregator** — processes metrics into hourly/daily summaries.
- **API** — serves processed metrics + LLM insights.

---

## Running the system

### 1. Build & seed data
```bash
docker compose up --build seeder
```

### 2. Run aggregator once (demo mode)
```bash
docker compose run aggregator node aggregator.js once
```

### 3. Start full system
```bash
docker compose up --build
```

## Environment Variables

Each service includes its own .env.example file.

Copy and rename to .env before running.

## LLM Integration

The API service can use:
* OpenAI (real)
* Mock LLM (offline)

## Folder Structure
root/
 ├── seeder/
 ├── aggregator/
 ├── api/
 └── docker-compose.yml

Each service is isolated and containerized independently.

## Notes
* Aggregator "loop mode" runs periodically.
* "Once mode" is used for demonstration and testing.
* Using two separate DBs prevents read-locking of production raw data.