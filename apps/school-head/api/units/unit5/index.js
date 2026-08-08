import express from 'express';
import { safeQuery } from '@shared/db';

const router = express.Router();

const toBool = (v) => {
    if (v === 1 || v === true || v === 'true' || v === '1') return true;
    if (v === 0 || v === false || v === 'false' || v === '0') return false;
    return false; 
};

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 5: SHIFTING & MODALITY
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/ph_schools/unit5/:id', async (req, res) => {
    const schoolId = req.params.id;
    const data = req.body;

    try {
        // Resolve canonical IERN & SchoolID
        let schoolRes = await safeQuery(
            `SELECT iern, school_id FROM ph_schools WHERE school_id = $1 OR iern = $1 LIMIT 1`,
            [schoolId]
        );
        if (schoolRes.rows.length === 0) {
            schoolRes = await safeQuery(
                `SELECT "IERN" as iern, "SchoolID" as school_id FROM "schools_IERN" WHERE "SchoolID" = $1 OR "IERN" = $1 LIMIT 1`,
                [schoolId]
            );
        }
        if (schoolRes.rows.length === 0) {
            return res.status(404).json({ error: 'School not found' });
        }
        const { iern, school_id } = schoolRes.rows[0];

        const school_yr = data.school_yr || 'SY 26-27';

        const insertFields = [
            'iern', 'school_id', 'school_yr',
            'has_standard_shifting', 'has_adms', 'adm_mdl', 'adm_odl', 'adm_tvi', 'adm_blended', 'shifting_modality',
            'shift_kinder', 'shift_g1', 'shift_g2', 'shift_g3', 'shift_g4', 'shift_g5', 'shift_g6', 'shift_g7', 'shift_g8', 'shift_g9', 'shift_g10', 'shift_g11', 'shift_g12', 'shift_mg_1', 'shift_mg_2', 'shift_mg_3',
            'mode_kinder', 'mode_g1', 'mode_g2', 'mode_g3', 'mode_g4', 'mode_g5', 'mode_g6', 'mode_g7', 'mode_g8', 'mode_g9', 'mode_g10', 'mode_g11', 'mode_g12', 'mode_mg_1', 'mode_mg_2', 'mode_mg_3',
            'unit5', 'unit5_completed', 'unit5_updated_at'
        ];

        const values = insertFields.map(f => {
            if (f === 'iern') return iern;
            if (f === 'school_id') return school_id;
            if (f === 'school_yr') return school_yr;
            if (f === 'unit5') return 100;
            if (f === 'unit5_completed') return true;
            if (f === 'unit5_updated_at') return new Date();
            
            // Explicit Boolean Casting
            if (f === 'has_standard_shifting') return toBool(data.has_standard_shifting);
            if (f === 'has_adms') return toBool(data.has_adms);
            if (f === 'adm_mdl') return toBool(data.adm_mdl);
            if (f === 'adm_odl') return toBool(data.adm_odl);
            if (f === 'adm_tvi') return toBool(data.adm_tvi);
            if (f === 'adm_blended') return toBool(data.adm_blended);
            
            return data[f];
        });

        const placeholders = insertFields.map((_, i) => `$${i + 1}`).join(', ');
        const updateFields = insertFields.filter(f => f !== 'iern' && f !== 'school_id' && f !== 'school_yr');
        const updateClause = updateFields.map((f, i) => `${f} = $${insertFields.indexOf(f) + 1}`).join(', ');

        // ── 1. VALIDATION LOCK CHECK & HYBRID JSONB UPSERT ──────────────────────
        const checkLock = await safeQuery(
            'SELECT validation_status, validation_remarks FROM ph_school_unit_submissions WHERE iern = $1 AND unit_number = 5',
            [iern]
        );
        if (checkLock.rows[0]?.validation_status === 'validated') {
            return res.status(403).json({ error: 'This module is validated and locked.' });
        }

        const currentStatus = checkLock.rows[0]?.validation_status || 'draft';
        const isResubmission = ['returned', 'rejected'].includes(currentStatus);
        const nextStatus = isResubmission ? 'submitted' : (data.is_completed !== false ? 'submitted' : 'draft');
        const nextRemarks = isResubmission ? null : (checkLock.rows[0]?.validation_remarks || null);

        await safeQuery(`
            INSERT INTO ph_school_unit_submissions 
                (iern, unit_number, payload, is_completed, validation_status, validation_remarks, submitted_at, updated_at)
            VALUES ($1, 5, $2, TRUE, $3, $4, NOW(), NOW())
            ON CONFLICT (iern, unit_number) DO UPDATE SET
                payload = EXCLUDED.payload,
                is_completed = TRUE,
                validation_status = EXCLUDED.validation_status,
                validation_remarks = EXCLUDED.validation_remarks,
                submitted_at = NOW(),
                updated_at = NOW()
        `, [iern, JSON.stringify(data), nextStatus, nextRemarks]);

        const result = await safeQuery(upsertQuery, values);



        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export { router as unit5Router };
export default router;
