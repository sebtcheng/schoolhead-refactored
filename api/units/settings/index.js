import express from 'express';
import csv from 'csv-parser';
import { pool } from '../../utils/db.js';

const router = reportError => express.Router(); // wait, let's keep it simple: express.Router()
const customRouter = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] SYSTEM SETTINGS, REFERENCES & UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

customRouter.get('/api/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    if (result.rowCount === 0) {
        if (key === 'nexus_module_locks') {
            return res.json({ value: JSON.stringify({ "school-info": false, "esf7": false, "nspp": true }) });
        }
        if (key === 'maintenance_mode') {
            return res.json({ value: 'false' });
        }
        return res.status(404).json({ error: 'Setting not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

customRouter.get('/api/reference/building-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reference_building_types ORDER BY name ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.json({ success: true, data: [
        { id: 1, name: "Gabo Type" },
        { id: 2, name: "Marcos Type" },
        { id: 3, name: "Bagong Lipunan" },
        { id: 4, name: "DepEd Standard" }
    ] });
  }
});

customRouter.get('/api/reference/functional-divisions', async (req, res) => {
  try {
    const result = await pool.query('SELECT governance_level, functional_division FROM ph_offices ORDER BY functional_division ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

customRouter.get('/api/health', (req, res) => {
  res.json({ status: 'online', pid: process.pid });
});

customRouter.get('/api/pool-status', (req, res) => {
  res.json({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

customRouter.get('/api/debug/seed-schools', async (req, res) => {
  const client = await pool.connect();

  try {
    const protocol = req.protocol;
    const host = req.get('host');
    const csvUrl = `${protocol}://${host}/schools.csv`;

    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);

    const csvText = await response.text();
    const results = [];
    const Readable = (await import('stream')).Readable;
    const s = new Readable();
    s.push(csvText);
    s.push(null); 

    await new Promise((resolve, reject) => {
      s.pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) return res.json({ message: "CSV is empty" });

    await client.query(`
            CREATE TABLE IF NOT EXISTS schools (
                school_id TEXT PRIMARY KEY,
                school_name TEXT,
                region TEXT,
                division TEXT,
                legislative_district TEXT,
                province TEXT,
                municipality TEXT,
                barangay TEXT,
                latitude TEXT,
                longitude TEXT,
                sub_office TEXT,
                school_type TEXT,
                school_abbreviation TEXT
            );
        `);

    const BATCH_SIZE = 1000;
    let inserted = 0;

    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = [];

      batch.forEach((row, rowIndex) => {
        const offset = rowIndex * 13;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13})`);
        values.push(
          row.school_id, row.school_name, row.region, row.division,
          row.legislative_district, row.province, row.municipality,
          row.barangay, row.latitude, row.longitude, row.sub_office,
          row.school_type, row.school_abbreviation
        );
      });

      await client.query(`
                INSERT INTO schools (
                    school_id, school_name, region, division,
                    legislative_district, province, municipality,
                    barangay, latitude, longitude, sub_office,
                    school_type, school_abbreviation
                ) VALUES ${placeholders.join(', ')}
                ON CONFLICT (school_id) DO NOTHING;
            `, values);

      inserted += batch.length;
    }

    res.json({ message: "Seeding complete", count: inserted });
  } catch (err) {
    res.status(500).json({ error: "Seeding failed", details: err.message });
  } finally {
    client.release();
  }
});

export { customRouter as settingsRouter };
export default customRouter;
