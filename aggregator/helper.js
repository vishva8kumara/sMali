
// ------------------ HELPERS ------------------

module.exports = function(analyticsDb, rawDb) {

	this.getLastProcessedTs = async function() {
		const res = await analyticsDb.query(
			`SELECT last_processed_ts
			FROM analytics.aggregation_run_state
			WHERE id = TRUE`);
		return res.rows[0]?.last_processed_ts || null;
	};

	this.setLastProcessedTs = async function(ts) {
		return await analyticsDb.query(
			`INSERT INTO analytics.aggregation_run_state (id, last_processed_ts)
			VALUES (TRUE, $1)
			ON CONFLICT (id)
			DO UPDATE SET last_processed_ts = EXCLUDED.last_processed_ts`,
			[ts]
		);
	}

	this.fetchRawMetrics = async function(sinceTs, untilTs) {
		const res = await rawDb.query(
			`SELECT server_id,
				   metric_type,
				   ts,
				   metric_value
			FROM raw.metrics
			WHERE ts > $1 AND ts <= $2
			ORDER BY ts ASC`,
			[sinceTs, untilTs]
		);
	  return res.rows;
	}

	this.aggregateRows = function(rows) {
		const grouped = {};

		for (const r of rows) {
			const key = `${r.server_id}|${r.metric_type}`;
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(Number(r.metric_value));
		}

		const result = [];

		for (const key of Object.keys(grouped)) {
			const [server_id, metric_type] = key.split('|');
			const values = grouped[key].sort((a, b) => a - b);

			const avg = values.reduce((a, b) => a + b, 0) / values.length;
			const min = values[0];
			const max = values[values.length - 1];
			const p90 = values[Math.floor(values.length * 0.9)];

			result.push({ server_id, metric_type, avg, min, max, p90 });
		}

		return result;
	}

	this.storeAggregates = async function(timestamp, aggregates) {
		for (const a of aggregates) {
			await analyticsDb.query(
				`INSERT INTO analytics.aggregated_metrics
					(server_id, metric_type, ts, avg_value, min_value, max_value, p90_value)
				VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					a.server_id,
					a.metric_type,
					timestamp,
					a.avg,
					a.min,
					a.max,
					a.p90,
				]
			);
		}
	}

	return this;
};
