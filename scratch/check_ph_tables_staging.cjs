const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging' });

pool.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_name IN ('ph_school_buildable_spaces','ph_buildings_inventory','ph_buildings_repairs','ph_buildings_demolition') 
  ORDER BY table_name
`).then(r => {
  console.log('Tables found in staging:');
  if (r.rows.length === 0) console.log('  (none found)');
  r.rows.forEach(row => console.log(' -', row.table_name));
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
