// Creates a new database only. Never overwrites an existing schema or data.
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');
const fs = require('node:fs/promises');
const path = require('node:path');

async function setup() {
  const name = process.env.DB_NAME || 'cybernyte';
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Invalid DB_NAME.');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });
  try {
    const [tables] = await connection.query(
      'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ?', [name]);
    if (tables.length) throw new Error(`${name} already contains tables. Nothing was changed. Use a new DB_NAME.`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``);
    await connection.changeUser({ database: name });
    await connection.query("SET time_zone = '+08:00'");
    for (const file of ['schema.sql', 'seed.sql']) {
      await connection.query(await fs.readFile(path.join(__dirname, '../sql', file), 'utf8'));
    }
    console.log(`Created ${name}: 11 tables, three starter records per business table, one cafe settings row.`);
  } finally { await connection.end(); }
}
setup().catch(error => { console.error(error.message); process.exitCode = 1; });
