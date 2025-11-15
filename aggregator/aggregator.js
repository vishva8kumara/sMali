import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// ------------------ DB CLIENTS ------------------

const rawDb = new pg.Client({
  host: process.env.RAW_DB_HOST,
  port: process.env.RAW_DB_PORT,
  user: process.env.RAW_DB_USER,
  password: process.env.RAW_DB_PASSWORD,
  database: process.env.RAW_DB_NAME,
});

const analyticsDb = new pg.Client({
  host: process.env.ANALYTICS_DB_HOST,
  port: process.env.ANALYTICS_DB_PORT,
  user: process.env.ANALYTICS_DB_USER,
  password: process.env.ANALYTICS_DB_PASSWORD,
  database: process.env.ANALYTICS_DB_NAME,
});

const INTERVAL_MIN = Number(process.env.AGG_INTERVAL_MINUTES || 5);

const helper = require('./helper')(analyticsDb, rawDb);

// ------------------ MAIN PROCESS ------------------

async function main() {
  await rawDb.connect();
  await analyticsDb.connect();

  const lastTs = await helper.getLastProcessedTs();
  const now = new Date();

  const nextTs = lastTs
    ? new Date(new Date(lastTs).getTime() + INTERVAL_MIN * 60_000)
    : new Date(Date.now() - INTERVAL_MIN * 60_000); // first run

  console.log('Last processed:', lastTs);
  console.log('Processing from:', nextTs);

  const rows = await helper.fetchRawMetrics(nextTs, now);

  if (rows.length === 0) {
    console.log('No new data. Exiting.');
    return;
  }

  const aggregates = helper.aggregateRows(rows);

  await helper.storeAggregates(now, aggregates);
  await helper.setLastProcessedTs(now);

  console.log(
    `Processed ${rows.length} raw rows → ${aggregates.length} aggregates.`
  );

  await rawDb.end();
  await analyticsDb.end();
}

main().catch((err) => console.error(err));
