const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config();

// ------------------ DB CLIENTS ------------------

const rawDb = new pg.Client({
  host: process.env.RAW_DB_HOST,
  port: process.env.RAW_DB_PORT,
  user: process.env.RAW_DB_USER,
  password: process.env.RAW_DB_PASS,
  database: process.env.RAW_DB_NAME,
});

const analyticsDb = new pg.Client({
  host: process.env.ANALYTICS_DB_HOST,
  port: process.env.ANALYTICS_DB_PORT,
  user: process.env.ANALYTICS_DB_USER,
  password: process.env.ANALYTICS_DB_PASS,
  database: process.env.ANALYTICS_DB_NAME,
});

const INTERVAL_MIN = Number(process.env.AGG_INTERVAL_MINUTES || 5);

const helper = require('./helper.js')(analyticsDb, rawDb);

// ------------------ MAIN PROCESS ------------------

async function main() {
  await rawDb.connect();
  await analyticsDb.connect();

  let lastTs = await helper.getLastProcessedTs();
  let now = helper.roundDateTime(new Date(), INTERVAL_MIN);

  console.log('Last processed:', lastTs, now);
  //console.log('Processing from:', nextTs);

  const rows = await helper.fetchRawMetrics(lastTs, now);

  if (rows.length === 0) {
    console.log('No new data.');
  }
  else {
	const roundedStartTs = helper.roundDateTime(rows[0].ts, INTERVAL_MIN);
    const aggregates = helper.aggregateRows(rows, roundedStartTs, now, INTERVAL_MIN * 60);

    await helper.storeAggregates(aggregates);
    await helper.setLastProcessedTs(now);

    console.log(
      `Processed ${rows.length} raw rows -> ${aggregates.length} aggregates.`
    );
  }

  await rawDb.end();
  await analyticsDb.end();

  return;

}

main().catch((err) => console.error(err));
