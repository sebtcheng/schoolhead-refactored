import express from 'express';
import { pool, safeQuery, safeUsersQuery } from '@shared/db';

const router = express.Router();

/**
 * GET /api/ph_schools/progress/:schoolId
 * Progress query builder decoupled from obsolete relations (ph_schools_validate, unit1-unit8).
 * Queries ph_schools and ph_school_unit_submissions directly.
 */
router.get('/api/ph_schools/progress/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const schoolYr = req.query.school_yr || 'SY 26-27';

    let schoolRes = await safeQuery(
      `SELECT ps.school_id, ps.iern, ps.school_name, ps.region, ps.division, ps.unit_completion, ps.is_esf7_opened,
       COALESCE(ps.unit1, 0) AS unit1, COALESCE(ps.unit1_completed, FALSE) AS unit1_completed, ps.unit1_updated_at,
       COALESCE(ps.unit2, 0) AS unit2, COALESCE(ps.unit2_completed, FALSE) AS unit2_completed, ps.unit2_updated_at,
       COALESCE(ps.unit3, 0) AS unit3, COALESCE(ps.unit3_completed, FALSE) AS unit3_completed, ps.unit3_updated_at,
       COALESCE(ps.unit4, 0) AS unit4, COALESCE(ps.unit4_completed, FALSE) AS unit4_completed, ps.unit4_updated_at,
       COALESCE(ps.unit5, 0) AS unit5, COALESCE(ps.unit5_completed, FALSE) AS unit5_completed, ps.unit5_updated_at,
       COALESCE(ps.unit6, 0) AS unit6, COALESCE(ps.unit6_completed, FALSE) AS unit6_completed, ps.unit6_updated_at,
       COALESCE(ps.unit7, 0) AS unit7, COALESCE(ps.unit7_completed, FALSE) AS unit7_completed, ps.unit7_updated_at,
       COALESCE(ps.unit8, 0) AS unit8, COALESCE(ps.unit8_completed, FALSE) AS unit8_completed, ps.unit8_updated_at,
       COALESCE(ps.unit9, 0) AS unit9, COALESCE(ps.unit9_completed, FALSE) AS unit9_completed, ps.unit9_updated_at
       FROM ph_schools ps
       WHERE ps.school_id = $1 OR ps.iern = $1`,
      [schoolId]
    ).catch(async (err) => {
      console.warn('[routes/schools.js progress] Query fallback:', err.message);
      return await safeQuery(
        'SELECT school_id, iern, school_name, region, division, unit_completion, is_esf7_opened FROM ph_schools WHERE school_id = $1 OR iern = $1',
        [schoolId]
      ).catch(() => ({ rowCount: 0, rows: [] }));
    });

    if (schoolRes.rowCount === 0) {
      // Auto-resolve school from schools_IERN master registry
      const iernRes = await safeUsersQuery(
        'SELECT school_id, iern, school_name, region, division FROM schools_iern WHERE school_id = $1 OR iern = $1 LIMIT 1',
        [schoolId]
      ).catch(() => ({ rowCount: 0, rows: [] }));

      if (iernRes.rowCount > 0) {
        const found = iernRes.rows[0];
        await safeQuery(
          'INSERT INTO ph_schools (school_id, iern, school_name, region, division) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (iern) DO UPDATE SET school_id = EXCLUDED.school_id',
          [String(found.school_id), found.iern, found.school_name, found.region, found.division]
        ).catch(() => {});
        schoolRes = {
          rowCount: 1,
          rows: [{
            school_id: String(found.school_id),
            iern: found.iern,
            school_name: found.school_name,
            region: found.region,
            division: found.division,
            unit_completion: 0,
            is_esf7_opened: false
          }]
        };
      } else {
        return res.status(404).json({ error: 'School not found' });
      }
    }

    const school = schoolRes.rows[0];
    const resolvedIern = school.iern || schoolId;

    // Fetch consolidated JSONB submissions & validation states
    const subRes = await safeQuery(
      `SELECT unit_number, validation_status, validation_remarks, validated_by, validated_at, is_completed, payload
       FROM ph_school_unit_submissions WHERE iern = $1`,
      [resolvedIern]
    ).catch(() => ({ rows: [] }));

    const submissions = {};
    subRes.rows.forEach(r => {
      submissions[`unit${r.unit_number}`] = {
        status: r.validation_status,
        remarks: r.validation_remarks,
        validated_by: r.validated_by,
        validated_at: r.validated_at,
        is_completed: r.is_completed,
        payload: r.payload
      };
    });

    const completedUnits = [];
    const flags = {};
    const validationFlags = {};
    let completedCount = 0;
    let validatedUnitsCount = 0;

    for (let i = 1; i <= 9; i++) {
      const sub = submissions[`unit${i}`];
      const isCompleted = sub?.is_completed || school[`unit${i}_completed`] === true || String(school[`unit${i}_completed`]) === 'true';
      const val = parseFloat(school[`unit${i}`]) || 0;
      const isHundred = Math.round(val) === 100;

      let unitProgress = 0;
      if (isCompleted || isHundred) {
        completedUnits.push(i);
        flags[`unit${i}`] = true;
        unitProgress = 100;
      } else if (val > 0) {
        unitProgress = val;
      }
      completedCount += (unitProgress / 100);

      const isValidated = sub?.status === 'validated';
      validationFlags[`unit${i}`] = isValidated;
      if (isValidated) validatedUnitsCount++;
    }

    const dynamicPercentage = parseFloat(((completedCount / 9) * 100).toFixed(2));
    const validationPercentage = parseFloat(((validatedUnitsCount / 9) * 100).toFixed(2));

    const completionRes = await safeQuery('SELECT * FROM ph_school_completion WHERE school_id = $1 OR iern = $1', [schoolId]).catch(() => ({ rows: [] }));

    const esf7Res = await pool.query(
      'SELECT status FROM esf7_link WHERE school_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [schoolId]
    ).catch(() => ({ rowCount: 0, rows: [] }));
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
          iern: school.iern,
          school_name: school.school_name,
          region: school.region,
          division: school.division,
          is_esf7_opened: school.is_esf7_opened === true || String(school.is_esf7_opened) === 'true'
        },
        submissions,
        progress: {
          percentage: dynamicPercentage,
          validation_percentage: validationPercentage,
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
    console.error('Progress handler error:', err);
    res.status(500).json({ error: err.message });
  }
});

export { router as schoolsRouter };
export default router;
