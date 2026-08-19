import express from 'express';
import { pool, poolUsers, safeQuery, safeUsersQuery } from '@shared/db';

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
    const result = await safeUsersQuery("SELECT DISTINCT region FROM schools_iern WHERE region IS NOT NULL AND TRIM(region) != '' ORDER BY region");
    res.json(result.rows.map(r => r.region));
  } catch (err) {
    console.error("❌ [/api/locations/regions] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/locations/provinces', async (req, res) => {
  try {
    const { region } = req.query;
    let query = "SELECT DISTINCT province FROM schools_iern WHERE province IS NOT NULL AND TRIM(province) != ''";
    let params = [];
    if (region && region !== 'undefined') {
      query += ' AND region = $1';
      params.push(region);
    }
    query += ' ORDER BY province';
    const result = await safeUsersQuery(query, params);
    res.json(result.rows.map(r => r.province));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/municipalities-by-province', async (req, regions) => {
  try {
    const { province, region } = req.query;
    if (!province || province === 'undefined') {
      return res.json([]);
    }
    let query = "SELECT DISTINCT municipality FROM schools_iern WHERE municipality IS NOT NULL AND TRIM(municipality) != '' AND province = $1";
    let params = [province];
    if (region && region !== 'undefined') {
      query += ' AND region = $2';
      params.push(region);
    }
    query += ' ORDER BY municipality';
    const result = await safeUsersQuery(query, params);
    res.json(result.rows.map(r => r.municipality));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/barangays', async (req, res) => {
  try {
    const { municipality, province, region } = req.query;
    if (!municipality || municipality === 'undefined') {
      return res.json([]);
    }
    let query = "SELECT DISTINCT barangay FROM schools_iern WHERE barangay IS NOT NULL AND TRIM(barangay) != '' AND municipality = $1";
    let params = [municipality];
    let pIdx = 2;
    if (province && province !== 'undefined') {
      query += ` AND province = $${pIdx++}`;
      params.push(province);
    }
    if (region && region !== 'undefined') {
      query += ` AND region = $${pIdx++}`;
      params.push(region);
    }
    query += ' ORDER BY barangay';
    const result = await safeUsersQuery(query, params);
    res.json(result.rows.map(r => r.barangay));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/divisions', async (req, res) => {
  try {
    const { region } = req.query;
    if (!region || region === 'undefined') {
      return res.json([]);
    }
    let query = "SELECT DISTINCT division FROM schools_iern WHERE division IS NOT NULL AND TRIM(division) != '' AND region = $1 ORDER BY division";
    const result = await safeUsersQuery(query, [region]);
    res.json(result.rows.map(r => r.division));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/legislative-districts', async (req, res) => {
  try {
    const { province, region } = req.query;
    if (!province || province === 'undefined') {
      return res.json([]);
    }
    let query = "SELECT DISTINCT legislative_district as leg_district FROM schools_iern WHERE legislative_district IS NOT NULL AND TRIM(legislative_district) != '' AND province = $1";
    let params = [province];
    if (region && region !== 'undefined') {
      query += ' AND region = $2';
      params.push(region);
    }
    query += ' ORDER BY legislative_district';
    const result = await safeUsersQuery(query, params);
    res.json(result.rows.map(r => r.leg_district));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/districts', async (req, res) => {
  try {
    const { region, division, municipality } = req.query;
    let query = "SELECT DISTINCT district FROM schools_iern WHERE district IS NOT NULL AND TRIM(district) != ''";
    let params = [];
    let pIdx = 1;

    if (region && region !== 'undefined') { query += ` AND region = $${pIdx++}`; params.push(region); }
    if (division && division !== 'undefined') { query += ` AND division = $${pIdx++}`; params.push(division); }
    if (municipality && municipality !== 'undefined') { query += ` AND municipality = $${pIdx++}`; params.push(municipality); }

    query += ' ORDER BY district';
    const result = await safeUsersQuery(query, params);
    res.json(result.rows.map(r => r.district));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/municipalities', async (req, res) => {
  try {
    const { region, division, district } = req.query;
    let query = "SELECT DISTINCT municipality FROM schools_iern WHERE municipality IS NOT NULL AND TRIM(municipality) != ''";
    let params = [];
    let pIdx = 1;

    if (region && region !== 'undefined') { query += ` AND region = $${pIdx++}`; params.push(region); }
    if (division && division !== 'undefined') { query += ` AND division = $${pIdx++}`; params.push(division); }
    if (district && district !== 'undefined') { query += ` AND district = $${pIdx++}`; params.push(district); }

    query += ' ORDER BY municipality';
    const result = await safeUsersQuery(query, params);
    res.json(result.rows.map(r => r.municipality));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/locations/schools', async (req, res) => {
  try {
    const { region, division, district, municipality } = req.query;
    let query = 'SELECT school_id, school_name, region, division, district, municipality, province, barangay, latitude, longitude FROM schools_iern WHERE school_id IS NOT NULL AND (status ILIKE \'Active\' OR status IS NULL)';
    let params = [];
    let pIdx = 1;

    if (region) { query += ` AND region = $${pIdx++}`; params.push(region); }
    if (division) { query += ` AND division = $${pIdx++}`; params.push(division); }
    if (district) { query += ` AND district = $${pIdx++}`; params.push(district); }
    if (municipality) { query += ` AND municipality = $${pIdx++}`; params.push(municipality); }

    query += ' ORDER BY school_name';
    const result = await safeUsersQuery(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/lists/divisions', async (req, res) => {
  try {
    const result = await safeUsersQuery(`
      SELECT MAX(division) as division, MAX(region) as region 
      FROM schools_iern 
      WHERE division IS NOT NULL AND region IS NOT NULL 
      GROUP BY UPPER(TRIM(division))
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
      SELECT school_id, school_name, region, division, latitude, longitude 
      FROM schools_iern 
      WHERE school_id IS NOT NULL
    `;
    const result = await safeUsersQuery(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch schools" });
  }
});

export { router as locationRouter };
export default router;
