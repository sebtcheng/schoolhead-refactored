const { Pool } = require('pg');
const staging = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging' });
const prod    = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd' });

const FIX = `
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unit9_safety' AND column_name = 'u9_general' AND data_type = 'integer') THEN
      ALTER TABLE unit9_safety ALTER COLUMN u9_general TYPE JSONB USING to_jsonb(u9_general);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unit9_safety' AND column_name = 'u9_wiring' AND data_type = 'integer') THEN
      ALTER TABLE unit9_safety ALTER COLUMN u9_wiring TYPE JSONB USING to_jsonb(u9_wiring);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unit9_safety' AND column_name = 'u9_cords_cctv' AND data_type = 'integer') THEN
      ALTER TABLE unit9_safety ALTER COLUMN u9_cords_cctv TYPE JSONB USING to_jsonb(u9_cords_cctv);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unit9_safety' AND column_name = 'u9_final' AND data_type = 'integer') THEN
      ALTER TABLE unit9_safety ALTER COLUMN u9_final TYPE JSONB USING to_jsonb(u9_final);
    END IF;
  END $$;
`;

async function fix(pool, label) {
  try {
    await pool.query(FIX);
    // Verify
    const r = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'unit9_safety' AND column_name IN ('u9_general','u9_wiring','u9_cords_cctv','u9_final')
    `);
    console.log(`✅ [${label}] Column types after fix:`);
    r.rows.forEach(c => console.log(`   ${c.column_name}: ${c.data_type}`));
  } catch (err) {
    console.error(`❌ [${label}] Error:`, err.message);
  } finally {
    await pool.end();
  }
}

Promise.all([
  fix(staging, 'STAGING'),
  fix(prod,    'PRODUCTION'),
]);
