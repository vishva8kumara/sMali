const express = require('express');
const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());

const generateInsightsLLM = require('./llm');

// ------------------ DB CLIENT ------------------

const analyticsDb = new pg.Client({
  host: process.env.ANALYTICS_DB_HOST,
  port: process.env.ANALYTICS_DB_PORT,
  user: process.env.ANALYTICS_DB_USER,
  password: process.env.ANALYTICS_DB_PASS,
  database: process.env.ANALYTICS_DB_NAME,
});

analyticsDb.connect()
  .then(() => console.log('API connected to analytics DB'))
  .catch(console.error);

// ------------------------------------------------
// HELPERS
// ------------------------------------------------

async function fetchAggregatedMetrics(startTs, endTs, server) {
  if (startTs.length < 20 && startTs.indexOf('.') == -1)
    startTs += '.000Z';
  //
  if (endTs.length < 20 && endTs.indexOf('.') == -1)
    endTs += '.000Z';
  //
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

async function fetchAvailablePeriods(server = false) {
  const res = await analyticsDb.query(
    `SELECT DISTINCT ts FROM public.aggregated_metrics `+
	(server ? 'WHERE server_id = $1 ' : ' ')+
    `ORDER BY ts ASC`,
    ( server ? [server] : [] )
  );
  function continuousPeriods(timestamps, stepMs = 20 * 60 * 1000) {
	if (timestamps.length === 0)
		return [];
	const maxPeriod = stepMs * 5;
	const periods = [];
	let start = timestamps[0].ts;
	let prev  = timestamps[0].ts;
	let samples = 0;
	for (let i = 1; i < timestamps.length; i++) {
		const cur = timestamps[i].ts;
		samples += 1;
		if (cur - prev > stepMs || prev - start > maxPeriod) {
			periods.push({ samples, start, end: prev });
			start = cur;
			samples = 0;
		}
		prev = cur;
	}
	periods.push({ samples: samples+1, start, end: prev });
	return periods;
  }

  return continuousPeriods( res.rows );
}

// ------------------------------------------------
// API ROUTE
// ------------------------------------------------

async function auth(req, _res, next) {
	console.log([
      req.socket.remoteAddress, `[${new Date().toLocaleString()}]`,
	  `"${req.method} ${req.url} HTTP/${req.httpVersion}"`
    ].join(' '));
	//
	//	TO DO: Authenticate the user to access data and insights
	next();
}

app.get('/insights', auth, async (req, res) => {
  try {
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
      server: (server || 'all'),
      response,
      //aggregates_count: aggregates.length,
      //data: restructured,
    });

  }
  catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

app.get('/periods', auth, async (req, res) => {
  try {
    const { server } = req.query;

    const periods = await fetchAvailablePeriods(server);

    if (periods.length === 0) {
      return res.status(404).json({
        message: 'No data. Run the pipeline',
      });
    }
	const output = periods.map(p => {
      const start = (new Date(p.start)).toISOString().replace('.000Z', '');
      const end   = (new Date(p.end)).toISOString().replace('.000Z', '');
      return {
        ...p, url: `/insights?start=${start}&end=${end}`
      };
    });

    return res.json({ output });

  }
  catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`API service running on port ${PORT}`)
);
