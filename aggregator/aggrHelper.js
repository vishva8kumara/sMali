
module.exports = function aggrHelper() {

	/**
	 * Aggregate raw metric rows into fixed time bins.
	 *
	 * Assigns each row to a bin (width = intervalSeconds) between sinceTs→untilTs,
	 * grouped by server_id + metric_type + binEnd. Computes avg/min/max/p90/p80
	 * for each group and returns one aggregated record per bin.
	 *
	 * @param {Array<Object>} rows		Raw metric rows from the primary DB.
	 * @param {Date} sinceTs			Start timestamp (inclusive of bins, but raw query uses ts > sinceTs).
	 * @param {Date} untilTs			End timestamp (exclusive for bins, raw query uses ts <= untilTs).
	 * @param {number} intervalSeconds	Width of each aggregation bucket in seconds (e.g., 300 for 5 minutes).
	 * @returns {Array<Object>}			Aggregated rows
	 */
	this.aggregateRows = function(rows, sinceTs, untilTs, intervalSeconds) {
		const bins = generateBins(sinceTs, untilTs, intervalSeconds);
		//console.log('Timestamp bins:', bins.length);
		const grouped = {};

		for (const r of rows) {
			const idx = findBinIndex(new Date(r.ts), bins, intervalSeconds);
			if (idx === null)
				continue;

			const binTs = bins[idx].end;  // interval end timestamp
			const key = `${r.server_id}|${r.metric_type}|${binTs}`;

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
			const ts = new Date(1*ts_bin);

			result.push({ server_id, metric_type, ts, avg, min, max, p90, p80 });
		}
		//console.log('Range:', result[0].ts, result[result.length-1].ts);

		return result;
	};

	/**
	 * Round a timestamp down to the nearest N-minute boundary.
	 *
	 * Use for *bin alignment* when aggregating metrics.
	 * Ensures all aggregation windows start/end on clean
	 * boundaries (e.g., 10:00, 10:05, 10:10)
	 *
	 * @param {Date|string} date  Input timestamp (local or UTC)
	 * @param {number} minutes    Interval size in minutes
	 * @returns {Date}            Rounded-down UTC timestamp
 	*/
	this.roundDateTime = function(date, minutes = 1) {
		if (typeof date == 'string')
			date = new Date(date);
		const utcTime = Date.UTC( date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), 0, 0 );
		//
		const minutesInMs = 1000 * 60 * minutes;
		const roundedTime = Math.floor(utcTime / minutesInMs) * minutesInMs;
		//
		const output = new Date(roundedTime);
		return output;
	};

	return this;
};

function generateBins(sinceTs, untilTs, intervalSeconds) {
	//console.log('generateBins:', sinceTs, untilTs);
	const bins = [];
	let cursor = new Date(Date.UTC( sinceTs.getUTCFullYear(),  sinceTs.getUTCMonth(),  sinceTs.getUTCDate(), sinceTs.getUTCHours(), sinceTs.getUTCMinutes(), sinceTs.getUTCSeconds(), 0 ));
	const until = new Date(Date.UTC( untilTs.getUTCFullYear(), untilTs.getUTCMonth(), untilTs.getUTCDate(), untilTs.getUTCHours(), untilTs.getUTCMinutes(),  untilTs.getUTCSeconds(), 0 ));

	while (cursor <= until) {
		const start = new Date(cursor);
		const end = new Date(cursor.getTime() + intervalSeconds * 1000);

		bins.push({ start: start.getTime(), end: end.getTime() });
		cursor = end;
	}
	return bins;
};

/**
 * Determine which time-series bin a timestamp belongs to.
 *
 * @param {Date} ts                Timestamp being classified
 * @param {Array} bins             Array from generateBins(), sorted ascending
 * @param {number} intervalSeconds Bin size in seconds. Not Used
 * @returns {number|null}          Index into bins[] or null if out of range
 */
function findBinIndex(ts, bins, _intervalSeconds) {
	const tsMs = ts.getTime();
	for (let i = 0; i < bins.length; i++) {
		if (tsMs > bins[i].start && tsMs <= bins[i].end) {
			return i;
		}
	}
	return null; // data outside range
}
/*function findBinIndex(ts, bins, intervalSeconds) {
    const tsMs = ts.getTime();
    const firstStart = bins[0].start;
    const lastEnd = bins[bins.length - 1].end;

    // Out-of-range check
    if (tsMs <= firstStart || tsMs > lastEnd) {
        return null;
    }

    const intervalMs = intervalSeconds * 1000;

    // Compute offset from start, determine exact bin
    const offset = tsMs - firstStart;
    const index = Math.floor(offset / intervalMs);

    return index >= 0 && index < bins.length ? index : null;
}*/
