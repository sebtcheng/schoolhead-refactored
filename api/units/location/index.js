import express from 'express';
import { pool, safeQuery } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] LOCATION & MASTERLIST LOOKUP APIS
// ─────────────────────────────────────────────────────────────────────────────

const buildMasterlistQuery = (baseQuery, filters) => {
  const { region, province, division, municipality, legislative_district } = filters;
  let where = [];
  let params = [];
  let pIdx = 1;

  if (region) { where.push(`"region" = $${pIdx++}`); params.push(region); }
  if (province) { where.push(`"province" = $${pIdx++}`); params.push(province); }
  if (division) { where.push(`"division" = $${pIdx++}`); params.push(division); }
  if (municipality) { where.push(`"municipality" = $${pIdx++}`); params.push(municipality); }
  if (legislative_district) { where.push(`"legislative_district" = $${pIdx++}`); params.push(legislative_district); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return { query: `${baseQuery}${whereClause ? ' ' + whereClause : ''}`, params };
};

router.get('/api/lists/provinces', async (req, res) => {
  try {
    const result = await safeQuery('SELECT DISTINCT province, region FROM schools WHERE province IS NOT NULL ORDER BY province');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/lists/municipalities', async (req, res) => {
  try {
    const { province } = req.query;
    let query = 'SELECT DISTINCT municipality, region, division, province FROM schools WHERE municipality IS NOT NULL';
    let params = [];
    if (province) {
      query += ' AND province = $1';
      params.push(province);
    }
    query += ' ORDER BY municipality';
    const result = await safeQuery(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/locations/regions', async (req, res) => {
  try {
    const result = await safeQuery('SELECT DISTINCT "Region" as region FROM "schools_IERN" WHERE "Region" IS NOT NULL ORDER BY "Region"');
    res.json(result.rows.map(r => r.region));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/provinces', async (req, res) => {
  try {
    const { region } = req.query;
    let query = 'SELECT DISTINCT "Province" as province FROM "schools_IERN" WHERE "Province" IS NOT NULL';
    let params = [];
    if (region && region !== 'BLANK REGION') {
      query += ' AND "Region" = $1';
      params.push(region);
    }
    query += ' ORDER BY "Province"';
    const result = await safeQuery(query, params);
    res.json(result.rows.map(r => r.province));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/municipalities-by-province', async (req, res) => {
  try {
    const { province } = req.query;
    const result = await safeQuery('SELECT DISTINCT "Municipality" as municipality FROM "schools_IERN" WHERE "Province" = $1 ORDER BY "Municipality"', [province]);
    res.json(result.rows.map(r => r.municipality));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/barangays', async (req, res) => {
  try {
    const { municipality } = req.query;
    const result = await safeQuery('SELECT DISTINCT "Barangay" as barangay FROM "schools_IERN" WHERE "Municipality" = $1 AND "Barangay" IS NOT NULL ORDER BY "Barangay"', [municipality]);
    res.json(result.rows.map(r => r.barangay));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/divisions', async (req, res) => {
  try {
    const { region } = req.query;
    const result = await safeQuery('SELECT DISTINCT "Division" as division FROM "schools_IERN" WHERE "Region" = $1 ORDER BY "Division"', [region]);
    res.json(result.rows.map(r => r.division));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/legislative-districts', async (req, res) => {
  try {
    const { province } = req.query;
    const result = await safeQuery('SELECT DISTINCT "Legislative_District" as leg_district FROM "schools_IERN" WHERE "Province" = $1 AND "Legislative_District" IS NOT NULL ORDER BY "Legislative_District"', [province]);
    res.json(result.rows.map(r => r.leg_district));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/districts', async (req, res) => {
  try {
    const { region, division, municipality } = req.query;
    let query = 'SELECT DISTINCT "District" as district FROM "schools_IERN" WHERE "District" IS NOT NULL';
    let params = [];
    let pIdx = 1;

    if (region) { query += ` AND "Region" = $${pIdx++}`; params.push(region); }
    if (division) { query += ` AND "Division" = $${pIdx++}`; params.push(division); }
    if (municipality) { query += ` AND "Municipality" = $${pIdx++}`; params.push(municipality); }

    query += ' ORDER BY "District"';
    const result = await safeQuery(query, params);
    res.json(result.rows.map(r => r.district));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/municipalities', async (req, res) => {
  try {
    const { region, division, district } = req.query;
    let query = 'SELECT DISTINCT "Municipality" as municipality FROM "schools_IERN" WHERE "Municipality" IS NOT NULL';
    let params = [];
    let pIdx = 1;

    if (region) { query += ` AND "Region" = $${pIdx++}`; params.push(region); }
    if (division) { query += ` AND "Division" = $${pIdx++}`; params.push(division); }
    if (district) { query += ` AND "District" = $${pIdx++}`; params.push(district); }

    query += ' ORDER BY "Municipality"';
    const result = await safeQuery(query, params);
    res.json(result.rows.map(r => r.municipality));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/schools', async (req, res) => {
  try {
    const { region, division, district, municipality } = req.query;
    let query = 'SELECT "SchoolID" as school_id, "School_Name" as school_name, "Region" as region, "Division" as division, "District" as district, "Municipality" as municipality, "Province" as province, "Barangay" as barangay, "Latitude" as latitude, "Longitude" as longitude FROM "schools_IERN" WHERE "SchoolID" IS NOT NULL AND "status" = \'Active\'';
    let params = [];
    let pIdx = 1;

    if (region) { query += ` AND "Region" = $${pIdx++}`; params.push(region); }
    if (division) { query += ` AND "Division" = $${pIdx++}`; params.push(division); }
    if (district) { query += ` AND "District" = $${pIdx++}`; params.push(district); }
    if (municipality) { query += ` AND "Municipality" = $${pIdx++}`; params.push(municipality); }

    query += ' ORDER BY "School_Name"';
    const result = await safeQuery(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/lists/divisions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT MAX("Division") as division, MAX("Region") as region 
      FROM "schools_IERN" 
      WHERE "Division" IS NOT NULL AND "Region" IS NOT NULL 
      GROUP BY UPPER(TRIM("Division"))
      ORDER BY division ASC
    `);
    res.json(result.rows); 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/offline/schools', async (req, res) => {
  try {
    const query = `
            SELECT "SchoolID" as school_id, "School_Name" as school_name, "Region" as region, "Division" as division, "Latitude" as latitude, "Longitude" as longitude 
            FROM "schools_IERN" 
            WHERE "SchoolID" IS NOT NULL
        `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch schools" });
  }
});

export { router as locationRouter };
export default router;
