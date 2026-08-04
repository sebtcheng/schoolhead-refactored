import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

// Source: insightEd on 20.24.58.49
const sourcePool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

// Target: siif_database on Azure
const targetPool = new Pool({
  connectionString: process.env.SIIF_DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/siif_database',
  ssl: { rejectUnauthorized: false }
});

async function syncSettings() {
  console.log('🚀 [SIIF-SETTINGS-SYNC] Syncing ONLY settings and system_settings to siif_database...');

  try {
    // 1. Sync settings table
    console.log('\n⚙️ [1/2] Fetching settings from source insightEd...');
    const settingsRes = await sourcePool.query('SELECT * FROM settings');
    console.log(`Found ${settingsRes.rows.length} rows in source settings.`);

    if (settingsRes.rows.length > 0) {
      for (const row of settingsRes.rows) {
        await targetPool.query(`
          INSERT INTO settings (key, value, updated_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = EXCLUDED.updated_at
        `, [row.key, row.value, row.updated_at]);
      }
      console.log('✅ Synced settings table.');
    }

    // 2. Sync system_settings table
    console.log('\n⚙️ [2/2] Fetching system_settings from source insightEd...');
    const sysSettingsRes = await sourcePool.query('SELECT * FROM system_settings');
    console.log(`Found ${sysSettingsRes.rows.length} rows in source system_settings.`);

    if (sysSettingsRes.rows.length > 0) {
      for (const row of sysSettingsRes.rows) {
        await targetPool.query(`
          INSERT INTO system_settings (setting_key, setting_value, updated_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (setting_key) DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            updated_at = EXCLUDED.updated_at
        `, [row.setting_key, row.setting_value, row.updated_at]);
      }
      console.log('✅ Synced system_settings table.');
    }

    // Audit check
    const targetSet = await targetPool.query('SELECT key, value FROM settings');
    console.log('\n📊 Synced Settings in siif_database:', targetSet.rows);

    console.log('\n🎉 [SUCCESS] SIIF settings sync complete!');
  } catch (err) {
    console.error('🔥 [ERROR] Settings sync failed:', err);
    process.exitCode = 1;
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

syncSettings();
