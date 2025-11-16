const LOCK_ID = 987654; // arbitrary 32-bit integer

module.exports = function dbHelper(analyticsDb, rawDb) {

	this.startAtomic = async function() {
		// Try to acquire the lock without waiting
		const lock = await analyticsDb.query(
			'SELECT pg_try_advisory_lock($1) AS acquired', [LOCK_ID]);

		if ( ! lock.rows[0].acquired ) {
			return [ false, null ];
		}

		const res = await analyticsDb.query(
			`SELECT last_processed_ts FROM run_state WHERE id = TRUE`);

		return [ true, res.rows[0]?.last_processed_ts || null ];
	};

	this.setLastProcessedTs = async function(ts) {
		return await analyticsDb.query(
			`INSERT INTO run_state (id, last_processed_ts)
			VALUES (TRUE, $1)
			ON CONFLICT (id)
			DO UPDATE SET last_processed_ts = EXCLUDED.last_processed_ts`,
			[ts]
		);
	};

	// Release the lock
	this.endAtomic = async function() {
		return await analyticsDb.query(
			'SELECT pg_advisory_unlock($1)', [LOCK_ID]);
	};

	this.fetchRawMetrics = async function(sinceTs, untilTs) {
		const res = await rawDb.query(
			`SELECT server_id, metric_type, ts, metric_value
			FROM metrics
			WHERE ts > $1 AND ts <= $2
			ORDER BY ts ASC`,
			[sinceTs, untilTs]
		);
	  return res.rows;
	};

	//	TO DO: Implement batch inserts. Multiple batches, not one large
	this.storeAggregates = async function(aggregates) {
		for (const a of aggregates) {
			await analyticsDb.query(
				`INSERT INTO aggregated_metrics
					(server_id, metric_type, ts, avg_value, min_value, max_value, p90_value, p80_value)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[ a.server_id, a.metric_type, a.ts, a.avg, a.min, a.max, a.p90, a.p80 ]
			);
		}
	};

	return this;
};
