
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

function generateValue(server, metric, minute) {
  const serverOffset = server === 'srv-3' ? 25 : 0;

  let base =
    {
      cpu: 20,
      memory: 40,
      disk_io: 50,
      net_io: 30,
    }[metric] + serverOffset;

  // CPU spikes every 2 hours
  if (metric === 'cpu') {
    if (minute % 120 === 119)
      return base + Math.random() * 40 + 40;
  }

  // Memory leak-like drift
  if (metric === 'memory' && server === 'srv-2') {
    return base + minute * 0.3 + Math.random() * 2;
  }

  // Massive IO bursts
  if (metric === 'disk_io') {
    if (minute % 75 === 74)
      return base + Math.random() * 200;
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
