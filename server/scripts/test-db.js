// Checks the PostgreSQL connection from server/.env and prints row counts per table.
// Usage (from server/): npm run db:test
const pool = require('../config/db');

const TABLES = [
  'departments',
  'shift_managers',
  'shifts',
  'tasks',
  'incidents',
  'incident_predictions',
  'notifications',
];

async function main() {
  const { rows } = await pool.query('SELECT NOW() AS now, current_database() AS db');
  console.log(`Connected to ${rows[0].db} at ${rows[0].now.toISOString()}`);

  for (const table of TABLES) {
    const result = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    console.log(`  ${table.padEnd(22)} ${result.rows[0].n}`);
  }
}

main()
  .catch((err) => {
    console.error('Database check failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
