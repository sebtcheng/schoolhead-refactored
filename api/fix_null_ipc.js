/**
 * fix_null_ipc.js
 * Generates IPC codes for engineer_form records where ipc IS NULL.
 * Format: INF-B-{funding_year}-{XXXXX} (5-digit sequential, per funding year)
 * Uses a single SQL UPDATE with ROW_NUMBER() — no per-row Node.js loop.
 * Run: node api/fix_null_ipc.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  statement_timeout: 300000, // 5 min
});

async function fixNullIpc() {
  const client = await pool.connect();
  try {
    // Check how many null IPCs we're dealing with
    const { rows: [{ cnt }] } = await client.query(
      `SELECT COUNT(*) AS cnt FROM engineer_form WHERE ipc IS NULL`
    );
    console.log(`🔍 Found ${cnt} records with null IPC.`);
    if (parseInt(cnt) === 0) {
      console.log('✅ Nothing to do.');
      return;
    }

    // Override server-side statement timeout for this session
    await client.query(`SET statement_timeout = 0`);
    await client.query(`SET lock_timeout = 0`);

    console.log('⚡ Running single-pass SQL update...');

    // Single atomic UPDATE using ROW_NUMBER() per funding_year group.
    // Offset each year's sequence past any existing INF-B-{year}-XXXXX records.
    const result = await client.query(`
      WITH existing_max AS (
        SELECT
          COALESCE(
            NULLIF(regexp_replace(ipc, '^INF-B-\\d+-', ''), ''),
            '0'
          )::integer AS seq,
          split_part(ipc, '-', 3)::integer AS yr
        FROM engineer_form
        WHERE ipc LIKE 'INF-B-%'
      ),
      max_per_year AS (
        SELECT yr, MAX(seq) AS max_seq
        FROM existing_max
        GROUP BY yr
      ),
      null_rows AS (
        SELECT
          project_id,
          COALESCE(funding_year, 0) AS yr,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(funding_year, 0)
            ORDER BY project_id ASC
          ) AS rn
        FROM engineer_form
        WHERE ipc IS NULL
      ),
      new_ipcs AS (
        SELECT
          n.project_id,
          'INF-B-' || n.yr || '-' || LPAD(
            (COALESCE(m.max_seq, 0) + n.rn)::text,
            5, '0'
          ) AS new_ipc
        FROM null_rows n
        LEFT JOIN max_per_year m ON m.yr = n.yr
      )
      UPDATE engineer_form ef
      SET ipc = ni.new_ipc
      FROM new_ipcs ni
      WHERE ef.project_id = ni.project_id
        AND ef.ipc IS NULL
    `);

    console.log(`✅ Done. ${result.rowCount} records updated.`);

    // Quick verification
    const { rows: [{ remaining }] } = await client.query(
      `SELECT COUNT(*) AS remaining FROM engineer_form WHERE ipc IS NULL`
    );
    console.log(`🔎 Null IPCs remaining: ${remaining}`);

    const { rows: bRows } = await client.query(`
      SELECT
        funding_year,
        COUNT(*) AS count,
        MIN(ipc) AS first_ipc,
        MAX(ipc) AS last_ipc
      FROM engineer_form
      WHERE ipc LIKE 'INF-B-%'
      GROUP BY funding_year
      ORDER BY funding_year
    `);
    console.log('\n📊 INF-B- IPC summary:');
    bRows.forEach(r =>
      console.log(`  Year ${r.funding_year}: ${r.count} records  [${r.first_ipc} → ${r.last_ipc}]`)
    );

  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixNullIpc();
