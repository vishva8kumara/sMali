import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

const realOpenAILLM = require('./llm');

// ------------------ DB CLIENT ------------------

const analyticsDb = new pg.Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

analyticsDb.connect()
  .then(() => console.log('API connected to analytics DB'))
  .catch(console.error);

// ------------------------------------------------
// HELPERS
// ------------------------------------------------

async function fetchAggregatedMetrics(startTs, endTs) {
  const res = await analyticsDb.query(
    `SELECT server_id,
        metric_type,
        ts,
        avg_value,
        min_value,
        max_value,
        p90_value
    FROM analytics.aggregated_metrics
    WHERE ts >= $1 AND ts <= $2
    ORDER BY ts ASC`,
    [startTs, endTs]
  );

  return res.rows;
}

// --------------- LLM (MOCK OR REAL) ------------------

async function generateInsightsLLM(aggregates) {
  // For initial testing without LLM -> mock summary
  if (!process.env.LLM_API_KEY) {
    return mockInsights(aggregates);
  }
  else
    return realOpenAILLM(aggregates);
}

function mockInsights(aggregates) {
  const summary = [];

  const byServer = {};
  for (const row of aggregates) {
    const key = row.server_id;
    if (!byServer[key]) byServer[key] = [];
    byServer[key].push(row);
  }

  for (const serverId of Object.keys(byServer)) {
    summary.push(
      `Server ${serverId} shows ${byServer[serverId].length} aggregated metric entries -- Mock LLM.`
    );
  }

  return summary.join('\n');
}

// ------------------------------------------------
// API ROUTE
// ------------------------------------------------

app.get('/insights', async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: 'Missing required query params: ?start=<iso> & end=<iso>',
      });
    }

    const aggregates = await fetchAggregatedMetrics(start, end);

    if (aggregates.length === 0) {
      return res.status(404).json({
        message: 'No aggregated metrics found for the given time window.',
      });
    }

    const insights = await generateInsightsLLM(aggregates);

    return res.json({
      start,
      end,
      aggregates_count: aggregates.length,
      aggregates,
      insights,
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`API service running on port ${PORT}`)
);
