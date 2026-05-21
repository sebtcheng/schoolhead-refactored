const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Renaming legacy ph_schools_audit table to ph_schools_audit_legacy...");
    await pool.query(`ALTER TABLE ph_schools_audit RENAME TO ph_schools_audit_legacy;`);
    console.log("Success!");
  } catch (err) {
    console.error("Migration failed:", err.message);
    if (err.message.includes("does not exist")) {
        console.log("Table already renamed or doesn't exist. Proceeding...");
    } else {
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main();
