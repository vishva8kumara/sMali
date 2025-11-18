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

const dbHelper = require('./dbHelper.js')(analyticsDb, rawDb);
const aggrHelper = require('./aggrHelper.js')();

// ------------------ MAIN PROCESS ------------------

async function main() {
	await rawDb.connect();
	await analyticsDb.connect();

	const [ acquired, lastTs ] = await dbHelper.startAtomic();
	if ( ! acquired ) {
		console.error('Failed pg_try_advisory_lock. Another instance running.');
	}
	else {
		console.log('Last processed:', lastTs);

		const now = aggrHelper.roundDateTime(new Date(), INTERVAL_MIN);
		const rows = await dbHelper.fetchRawMetrics(lastTs, now);

		if (rows.length === 0) {
			console.warn('No new data.');
		}
		else {
			const roundedStartTs = aggrHelper.roundDateTime(rows[0].ts, INTERVAL_MIN);
			//const roundedEndTs = aggrHelper.roundDateTime(rows[rows.length-1].ts, INTERVAL_MIN);
			//console.log('Range:', rows[0].ts, roundedStartTs, ' - ', rows[rows.length-1].ts, roundedEndTs);

			const aggregates = aggrHelper.aggregateRows(rows, roundedStartTs, now, INTERVAL_MIN * 60);

			await dbHelper.storeAggregates(aggregates);

			await dbHelper.setLastProcessedTs(rows[rows.length-1].ts);//now
			// boundary alignment safety:
			// * Use (now) to ensure consistent hourly/5-minute bins - drops any deplayed data
			// * Use (rows[rows.length-1].ts) to even capture delayed data - may violate consistat bins

			console.log(
				`Processed ${rows.length} raw rows -> ${aggregates.length} aggregates.`
			);
		}
		await dbHelper.endAtomic();
	}

	await rawDb.end();
	await analyticsDb.end();

	return;
}

main().catch((err) => console.error(err));
