import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config();

const app = express();
app.use(express.json());

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
      `Server ${serverId} shows ${byServer[serverId].length} aggregated metric entries with normal behaviour.`
    );
  }

  return summary.join('\n');
}

async function realOpenAILLM(aggregates) {
  const text = JSON.stringify(aggregates, null, 2);

  const prompt = `
You are an expert systems engineer. Analyze the following aggregated server metrics:

${text}

Provide:
- trends
- anomalies
- spikes or drifts
- high-level recommendations
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();

  return data.choices?.[0]?.message?.content || 'No insights generated.';
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
