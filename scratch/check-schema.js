import { poolUsers } from '../packages/shared-db/src/db.js';

async function checkSchema() {
  try {
    const res = await poolUsers.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_schoolhead';
    `);
    console.log("Columns of user_schoolhead:", res.rows.map(r => `${r.column_name}: ${r.data_type}`));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await poolUsers.end();
    process.exit(0);
  }
}

checkSchema();
