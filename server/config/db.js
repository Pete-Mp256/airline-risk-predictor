const { Pool, types } = require('pg');
require('dotenv').config();

// DATE -> 'YYYY-MM-DD' string (the default JS Date shifts it by the server's UTC offset).
types.setTypeParser(types.builtins.DATE, (value) => value);
// NUMERIC -> number (values here are small: scores, temperatures, hours).
types.setTypeParser(types.builtins.NUMERIC, (value) => (value === null ? null : parseFloat(value)));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
