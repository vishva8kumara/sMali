
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config(); // loads seeder/.env

const client = new pg.Client({
  host: process.env.RAW_DB_HOST,
  port: Number(process.env.RAW_DB_PORT || 5432),
  user: process.env.RAW_DB_USER,
  password: process.env.RAW_DB_PASS,
  database: process.env.RAW_DB_NAME,
});

const SERVERS = ['srv-1', 'srv-2', 'srv-3'];
const METRICS = ['cpu', 'memory', 'disk_io', 'net_io'];

// ----- ARTIFACT EVENT GENERATORS -----
function randomNormal(base, variance) {
  return base + (Math.random() - 0.5) * variance;
}

// ----- SELECT BEHAVIOR FOR EACH METRIC -----
const seeds = {
	cpu: { 'srv-1': 120, 'srv-2': 160, 'srv-3': 200 },
	disk: { 'srv-1': 75, 'srv-2': 80, 'srv-3': 100 }
};

function generateValue(server, metric, minute) {
  const serverOffset = server === 'srv-3' ? 15 : 0;

  let base =
    {
      cpu: 20,
      memory: 40,
      disk_io: 50,
      net_io: 30,
    }[metric] + serverOffset;

  // CPU spikes every 2 hours
  if (metric === 'cpu') {
	if (minute % seeds.cpu[server] > seeds.cpu[server]-3)
      return base + Math.random() * 25 + 40;
  }

  // Memory leak-like drift
  if (metric === 'memory' && server === 'srv-2') {
    return Math.min(base + (minute % seeds.cpu[server]) * 0.3 + Math.random() * 5, 99);
  }

  // Massive IO bursts
  if (metric === 'disk_io') {
    if (minute % seeds.disk[server] > seeds.disk[server]-3 || minute % seeds.cpu[server] < 2)
      return base + Math.random() * 100 + 100;
  }

  // High net_io periods
  if (metric === 'net_io' && server === 'srv-1') {
    if (minute % seeds.disk[server] > seeds.disk[server] - (10 + Math.random() * 10))
      return base + Math.random() * 100 + 100;
  }

  return randomNormal(base, 10);
}

async function main() {
  await client.connect();
  console.log('Connected to', process.env.RAW_DB_HOST);

  console.log('Seeding raw metrics...');

  const now = Date.now();
  const rows = [];
  const minutes = 24 * 60 * 0.75; // 1 day(s)

  for (let minute = 0; minute < minutes; minute++) {
    for (const server of SERVERS) {
      for (const metric of METRICS) {
        const value = generateValue(server, metric, minute);
        const ts = new Date(now - (minutes - minute) * 60 * 1000);

        rows.push({
          text: `INSERT INTO metrics (server_id, metric_type, metric_value, ts)
                 VALUES ($1, $2, $3, $4)`,
          values: [server, metric, value, ts],
        });
      }
    }
  }

  for (const q of rows) {
    await client.query(q);
  }

  console.log('Done! Inserted', rows.length, 'rows.');
  await client.end();
}

main().catch((err) => console.error(err));
