import express from 'express';
import { pool, safeQuery } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] DASHBOARD & ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/api/schools/:school_id/units/:unit_number/complete', async (req, res) => {
  const { school_id, unit_number } = req.params;
  const unitNum = parseInt(unit_number, 10);
  if (isNaN(unitNum) || unitNum < 1 || unitNum > 8) {
    return res.status(400).json({ error: `Invalid unit_number "${unit_number}"` });
  }
  const col = `unit${unitNum}`;
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `UPDATE ph_schools SET ${col} = 1 WHERE school_id = $1
       RETURNING unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit_completion`,
      [school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "School not found" });
    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        unit1: row.unit1, unit2: row.unit2, unit3: row.unit3, unit4: row.unit4,
        unit5: row.unit5, unit6: row.unit6, unit7: row.unit7, unit8: row.unit8,
        unit_completion: parseFloat(parseFloat(row.unit_completion || 0).toFixed(2))
      }
    });
  } catch (err) {
    console.error('PATCH unit complete error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    if (client) client.release();
  }
});

router.get('/api/schools/:schoolId/activity', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const schoolRes = await safeQuery(
      `SELECT
        school_id, school_name,
        unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9,
        unit1_completed, unit2_completed, unit3_completed, unit4_completed,
        unit5_completed, unit6_completed, unit7_completed, unit8_completed, unit9_completed,
        unit_completion, region, division
       FROM ph_schools WHERE school_id = $1`,
      [schoolId]
    );
    if (schoolRes.rows.length === 0) return res.status(404).json({ error: "School not found" });

    const row = schoolRes.rows[0];
    const totalUnits = 9;
    let completedUnitsCount = 0;
    let completedFlags = {};

    const unitMapping = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < unitMapping.length; i++) {
      const dbIdx = unitMapping[i];
      const displayId = i + 1;
      const intVal = parseInt(row[`unit${dbIdx}`]) || 0;
      const boolVal = row[`unit${dbIdx}_completed`] === true;
      const isDone = (intVal === 1 || boolVal);

      completedFlags[`unit${displayId}`] = isDone;
      if (isDone) completedUnitsCount++;
    }

    const overall_progress_percentage = parseFloat(((completedUnitsCount / totalUnits) * 100).toFixed(2));

    const sprintRes = await pool.query(
      `SELECT unit_id, duration_seconds FROM ph_performance_logs 
       WHERE school_id = $1 ORDER BY duration_seconds ASC LIMIT 1`,
      [schoolId]
    );
    let fastest_sprint = null;
    if (sprintRes.rows.length > 0) {
      const r = sprintRes.rows[0];
      fastest_sprint = { unit: r.unit_id, time_text: `${Math.floor(r.duration_seconds / 60)}m ${r.duration_seconds % 60}s` };
    }

    const divRes = await pool.query(`SELECT AVG(COALESCE(unit_completion, 0)) as avg FROM ph_schools WHERE division = $1`, [row.division]);
    const regRes = await pool.query(`SELECT AVG(COALESCE(unit_completion, 0)) as avg FROM ph_schools WHERE region = $1`, [row.region]);

    res.json({
      success: true,
      data: {
        schoolInfo: { school_id: row.school_id, school_name: row.school_name },
        progress: { completedUnits: completedUnitsCount, totalUnits, percentage: overall_progress_percentage, flags: completedFlags },
        gamification: { fastest_sprint },
        comparative: [
          { name: 'My School', completed: overall_progress_percentage },
          { name: 'Division Avg', completed: parseFloat(parseFloat(divRes.rows[0]?.avg || 0).toFixed(1)) },
          { name: 'Region Avg', completed: parseFloat(parseFloat(regRes.rows[0]?.avg || 0).toFixed(1)) }
        ]
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [InsightEd Quest] SCHOOL HEAD DASHBOARD ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/api/school-by-user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const userRes = await pool.query('SELECT school_id FROM users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) return res.status(404).json({ exists: false, error: 'User not found' });
    const schoolId = userRes.rows[0].school_id;
    if (!schoolId) return res.status(404).json({ exists: false, error: 'User has no school assigned' });
    const schoolRes = await safeQuery(`
      SELECT 
        ps.*,
        v.unit1_validated, v.unit2_validated, v.unit3_validated, v.unit4_validated, v.unit5_validated,
        v.unit6_validated, v.unit7_validated, v.unit8_validated, v.unit9_validated,
        v.validation_percentage, v.validated_units_count, v.needs_validation
      FROM ph_schools ps
      LEFT JOIN ph_schools_validate v ON ps.school_id = v.school_id
      WHERE ps.school_id = $1
    `, [schoolId]);
    res.json({ exists: schoolRes.rowCount > 0, data: schoolRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/iern/:school_id', async (req, res) => {
  try {
    const { school_id } = req.params;
    const result = await safeQuery(
      `SELECT "IERN" FROM "schools_IERN" WHERE "SchoolID" = $1 LIMIT 1`,
      [school_id]
    );
    if (result.rows.length === 0) return res.json({ iern: null });
    res.json({ iern: result.rows[0].IERN });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/school-head/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const result = await safeQuery('SELECT first_name, last_name, office, region, division, account_category FROM users WHERE uid = $1', [uid]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'School Head not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/schools_iern/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await safeQuery('SELECT * FROM "schools_IERN" WHERE "SchoolID" = $1', [id]);
    res.json({ exists: result.rowCount > 0, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/ph_schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let result;
    try {
      result = await safeQuery('SELECT * FROM ph_schools WHERE school_id = $1', [id]);
    } catch (err) {
      if (err.message.includes('terminated unexpectedly')) {
        result = await safeQuery('SELECT * FROM ph_schools WHERE school_id = $1', [id]);
      } else {
        throw err;
      }
    }
    res.json({ exists: result.rowCount > 0, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/audit/remarks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await safeQuery('SELECT * FROM audit_feedback_tasks WHERE school_id = $1 ORDER BY created_at DESC', [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.get('/api/schools/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolRes = await safeQuery('SELECT * FROM ph_schools WHERE school_id = $1', [id]);
    const completionRes = await safeQuery('SELECT * FROM ph_school_completion WHERE school_id = $1', [id]);
    
    const school = schoolRes.rows[0] || {};
    const flags = {};
    const completedUnits = [];
    for (let i = 1; i <= 9; i++) {
        const val = school[`unit${i}`];
        if (Number(val) === 100 || school[`unit${i}_completed`] === true) {
            flags[`unit${i}`] = true;
            completedUnits.push(i);
        }
    }

    res.json({
      success: true,
      data: {
        schoolInfo: school,
        progress: {
          percentage: school.completion_percentage || 0,
          completedUnits,
          flags
        },
        gamification: completionRes.rows[0] || {}
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/ph_schools/progress/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;

    const schoolRes = await safeQuery(
      `SELECT ps.school_id, ps.school_name, ps.region, ps.division, ps.unit_completion, ps.is_esf7_opened,
       ps.unit1, ps.unit2, ps.unit3, ps.unit4, ps.unit5, ps.unit6, ps.unit7, ps.unit8, ps.unit9,
       ps.unit1_completed, ps.unit2_completed, ps.unit3_completed, ps.unit4_completed,
       ps.unit5_completed, ps.unit6_completed, ps.unit7_completed, ps.unit8_completed, ps.unit9_completed,
       ps.unit1_updated_at, ps.unit2_updated_at, ps.unit3_updated_at, ps.unit4_updated_at,
       ps.unit5_updated_at, ps.unit6_updated_at, ps.unit7_updated_at, ps.unit8_updated_at, ps.unit9_updated_at,
       v.unit1_validated, v.unit2_validated, v.unit3_validated, v.unit4_validated, v.unit5_validated,
       v.unit6_validated, v.unit7_validated, v.unit8_validated, v.unit9_validated,
       v.validation_percentage
       FROM ph_schools ps
       LEFT JOIN ph_schools_validate v ON ps.school_id = v.school_id
       WHERE ps.school_id = $1`, [schoolId]
    );
    
    if (schoolRes.rowCount === 0) return res.status(404).json({ error: 'School not found' });
    const school = schoolRes.rows[0];

    const completedUnits = [];
    const flags = {};
    const validationFlags = {};
    for (let i = 1; i <= 9; i++) {
      const isCompleted = school[`unit${i}_completed`] === true || String(school[`unit${i}_completed`]) === 'true';
      const isHundred = Math.round(Number(school[`unit${i}`]) || 0) === 100;
      
      if (isCompleted || isHundred) {
        completedUnits.push(i);
        flags[`unit${i}`] = true;
      }
      
      validationFlags[`unit${i}`] = school[`unit${i}_validated`] === true;
    }

    const completionRes = await safeQuery('SELECT * FROM ph_school_completion WHERE school_id = $1', [schoolId]);

    const esf7Res = await pool.query(
      'SELECT status FROM esf7_link WHERE school_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [schoolId]
    );
    let esf7Progress = 0;
    if (esf7Res.rowCount > 0) {
      const status = esf7Res.rows[0].status;
      if (['SUBMITTED', 'PROCESSING', 'QUEUE'].includes(status)) {
        esf7Progress = 50;
      } else if (status === 'VERIFIED') {
        esf7Progress = 100;
      }
    }

    res.json({
      success: true,
      data: {
        schoolInfo: {
          school_id: school.school_id,
          school_name: school.school_name,
          region: school.region,
          division: school.division,
          is_esf7_opened: school.is_esf7_opened === true || String(school.is_esf7_opened) === 'true'
        },
        progress: {
          percentage: school.unit_completion ? parseFloat(school.unit_completion) : 0,
          validation_percentage: school.validation_percentage ? parseFloat(school.validation_percentage) : 0,
          esf7_progress: esf7Progress,
          completedUnits: completedUnits,
          flags: flags,
          validationFlags: validationFlags,
          timestamps: {
            unit1: school.unit1_updated_at,
            unit2: school.unit2_updated_at,
            unit3: school.unit3_updated_at,
            unit4: school.unit4_updated_at,
            unit5: school.unit5_updated_at,
            unit6: school.unit6_updated_at,
            unit7: school.unit7_updated_at,
            unit8: school.unit8_updated_at,
            unit9: school.unit9_updated_at
          }
        },
        gamification: completionRes.rows[0] || {}
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/monitoring/schools', async (req, res) => {
  try {
    const { region, division, page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        v.school_id, v.school_name, v.region, v.division,
        v.unit1_completed as u1_status, v.unit2_completed as u2_status, v.unit3_completed as u3_status,
        v.unit4_completed as u4_status, v.unit5_completed as u5_status, v.unit6_completed as u6_status,
        v.unit7_completed as u7_status, v.unit8_completed as u8_status, v.unit9_completed as u9_status,
        v.unit1_validated, v.unit2_validated, v.unit3_validated, v.unit4_validated, v.unit5_validated,
        v.unit6_validated, v.unit7_validated, v.unit8_validated, v.unit9_validated,
        v.needs_validation, v.validation_percentage,
        ps.completion_percentage,
        ps.data_health_score, ps.data_health_description, ps.data_quality_issues
      FROM ph_schools_validate v
      JOIN ph_schools ps ON v.school_id = ps.school_id
      WHERE 1=1
    `;
    
    let params = [];
    let pIdx = 1;
    
    if (region) { query += ` AND v.region = $${pIdx++}`; params.push(region); }
    if (division) { query += ` AND v.division = $${pIdx++}`; params.push(division); }
    if (search) { 
      query += ` AND (v.school_name ILIKE $${pIdx} OR v.school_id ILIKE $${pIdx})`; 
      params.push(`%${search}%`);
      pIdx++;
    }
    
    const countQuery = `SELECT COUNT(*) FROM (${query}) as count_query`;
    const countRes = await safeQuery(countQuery, params);
    const total = parseInt(countRes.rows[0].count);
    
    query += ` ORDER BY v.school_name LIMIT $${pIdx++} OFFSET $${pIdx++}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      data: result.rows,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      page: parseInt(page)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as dashboardRouter };
export default router;
