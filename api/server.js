const express = require('express');
const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());

const generateInsightsLLM = require('./llm');

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

async function fetchAggregatedMetrics(startTs, endTs, server) {
  const res = await analyticsDb.query(
    `SELECT server_id, metric_type, ts, avg_value, min_value, max_value
    FROM aggregated_metrics
    WHERE ts >= $1 AND ts <= $2`+
	(server ? ' AND server_id = $3 ' : ' ')+
    `ORDER BY ts ASC`,
    ( server ? [startTs, endTs, server] : [startTs, endTs] )
  );

  return res.rows;
}

// --------------- LLM (MOCK OR REAL) ------------------



// ------------------------------------------------
// API ROUTE
// ------------------------------------------------

app.get('/insights', async (req, res) => {
  //try {
    const { start, end, server } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: 'Missing required query params: ?start=<iso> & end=<iso>',
      });
    }

    const aggregates = await fetchAggregatedMetrics(start, end, server);

    if (aggregates.length === 0) {
      return res.status(404).json({
        message: 'No aggregated metrics found for the given time window.',
      });
    }

    const [ response, restructured ] = await generateInsightsLLM(aggregates);

    return res.json({
      start,
      end,
      //aggregates_count: aggregates.length,
      response,
      data: restructured,
    });
  /*} catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }*/
});

// ------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`API service running on port ${PORT}`)
);
