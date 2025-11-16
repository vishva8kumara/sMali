
// ------------------ HELPERS ------------------

module.exports = function(analyticsDb, rawDb) {

	this.getLastProcessedTs = async function() {
		const res = await analyticsDb.query(
			`SELECT last_processed_ts
			FROM run_state
			WHERE id = TRUE`);
		return res.rows[0]?.last_processed_ts || null;
	};

	this.setLastProcessedTs = async function(ts) {
		return await analyticsDb.query(
			`INSERT INTO run_state (id, last_processed_ts)
			VALUES (TRUE, $1)
			ON CONFLICT (id)
			DO UPDATE SET last_processed_ts = EXCLUDED.last_processed_ts`,
			[ts]
		);
	}

	this.fetchRawMetrics = async function(sinceTs, untilTs) {
		const res = await rawDb.query(
			`SELECT server_id, metric_type, ts, metric_value
			FROM metrics
			WHERE ts > $1 AND ts <= $2
			ORDER BY ts ASC`,
			[sinceTs, untilTs]
		);
	  return res.rows;
	}

	function generateBins(sinceTs, untilTs, intervalSeconds) {
		//console.log('generateBins:', sinceTs, untilTs);
		const bins = [];
		let cursor = new Date(sinceTs);

		while (cursor <= untilTs) {
			const start = new Date(cursor);
			const end = new Date(cursor.getTime() + intervalSeconds * 1000);

			bins.push({ start, end });
			cursor = end;
		}
		return bins;
	}

	function findBinIndex(ts, bins, intervalSeconds) {
		const tsMs = ts.getTime();
		for (let i = 0; i < bins.length; i++) {
			if (tsMs > bins[i].start.getTime() && tsMs <= bins[i].end.getTime()) {
				return i;
			}
		}
		return null; // data outside range
	}

	this.aggregateRows = function(rows, sinceTs, untilTs, intervalSeconds) {
		const bins = generateBins(sinceTs, untilTs, intervalSeconds);
		//console.log('Timestamp bins:', bins.length);
		const grouped = {};

		for (const r of rows) {
			const idx = findBinIndex(new Date(r.ts), bins, intervalSeconds);
			if (idx === null)
				continue;

			const binTs = bins[idx].end;  // interval end timestamp
			const key = `${r.server_id}|${r.metric_type}|${binTs.toISOString()}`;

			if (!grouped[key])
				grouped[key] = [];

			grouped[key].push(Number(r.metric_value));
		}
		//console.log('Aggregated values:', Object.keys(grouped).length);

		const result = [];

		for (const key in grouped) {
			const [server_id, metric_type, ts_bin] = key.split('|');
			const values = grouped[key].sort((a, b) => a - b);

			const avg = values.reduce((a, b) => a + b, 0) / values.length;
			const min = values[0];
			const max = values[values.length - 1];
			const p90 = values[Math.floor(values.length * 0.9)];
			const p80 = values[Math.floor(values.length * 0.8)];
			const ts = new Date(ts_bin);

			result.push({ server_id, metric_type, ts, avg, min, max, p90, p80 });
		}

		return result;
	}

	this.storeAggregates = async function(aggregates) {
		for (const a of aggregates) {
			await analyticsDb.query(
				`INSERT INTO aggregated_metrics
					(server_id, metric_type, ts, avg_value, min_value, max_value, p90_value, p80_value)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[ a.server_id, a.metric_type, a.ts, a.avg, a.min, a.max, a.p90, a.p80 ]
			);
		}
	}

	this.roundDateTime = function(date, minutes = 1) {
		//console.log('date before round:', date);
		if (typeof date == 'string')
			date = new Date(date);
		//
		const minutesInMs = 1000 * 60 * minutes;
		const roundedTime = Math.floor(date.getTime() / minutesInMs) * minutesInMs;
		//
		const output = new Date(roundedTime);
		//console.log('date after round:', date.getTime(), roundedTime, output);
		return output;
	}

	return this;
};
