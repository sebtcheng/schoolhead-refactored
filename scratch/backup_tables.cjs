'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const tables = [
  'engineer_form',
  'engineer_image',
  'engineer_documents',
  'variation_orders',
  'engineer_projects_inventory',
  'engineer_create',
  'engineer_create_updates'
];

async function run() {
  const client = await pool.connect();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
  try {
    for (const table of tables) {
      const backupTable = `bak_${table}_${timestamp.substring(0, 10).replace(/-/g, '')}`;
      console.log(`Backing up ${table} to ${backupTable}...`);
      await client.query(`CREATE TABLE IF NOT EXISTS ${backupTable} AS SELECT * FROM ${table}`);
      console.log(`Backup of ${table} complete.`);
    }
  } catch (err) {
    console.error('Backup failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
