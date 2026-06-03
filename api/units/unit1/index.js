import express from 'express';
import { pool, safeQuery } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 1: SCHOOL IDENTITY
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/ph_schools/unit1', async (req, res) => {
    const data = req.body;
    const { school_id, iern } = data;
    if (!school_id && !iern) return res.status(400).json({ error: "Missing school_id or iern" });

    try {
        let client;
        let colRes;
        try {
            colRes = await safeQuery(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ph_schools'`);
        } catch (err) {
            if (err.message && err.message.includes('terminated unexpectedly')) {
                client = await pool.connect();
                try { colRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ph_schools'`); }
                finally { client.release(); }
            } else { throw err; }
        }
        const existingCols = new Set(colRes.rows.map(r => r.column_name));

        const allPotentialFields = [
            'school_name', 'region', 'province', 'municipality', 'barangay', 'division', 'district', 'leg_district',
            'curricular_offering', 'latitude', 'longitude', 'school_head', 'contact_number', 'ownership',
            'ownership_document_type', 'google_drive_thumbnail_url', 'school_type', 'mother_school_id',
            'extension_mother_school_name', 'established_month', 'established_year', 'head_first_name',
            'head_middle_name', 'head_last_name', 'head_sex', 'head_position_title', 'head_date_hired',
            'ownership_na_reason', 'google_drive_link', 'google_drive_file_id', 'google_drive_file_name',
            'ownership_doc_id', 'ownership_document_path', 'local_file_path', 'local_file_name', 'local_file_size',
            'ownership_multiple', 'ownership_document_multiple',
            'unit1', 'unit1_completed', 'unit1_updated_at'
        ];

        const fields = allPotentialFields.filter(f => existingCols.has(f));

        const values = fields.map(f => {
            if (f === 'unit1') return 100;
            if (f === 'unit1_completed') return true;
            if (f === 'unit1_updated_at') return new Date();
            
            let val = data[f];
            if ((f === 'ownership_multiple' || f === 'ownership_document_multiple') && Array.isArray(val)) {
                return JSON.stringify(val);
            }
            return val;
        });

        if (fields.length === 0) return res.status(400).json({ error: "No valid fields to update" });

        const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
        const query = `UPDATE ph_schools SET ${setClause} WHERE school_id = $${fields.length + 1} OR iern = $${fields.length + 1} RETURNING *`;
        
        const result = await safeQuery(query, [...values, school_id || iern]);
        if (result.rowCount === 0) return res.status(404).json({ error: "School not found" });

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Unit 1 Update Error:", err);
        res.status(500).json({ error: err.message });
    }
});

export { router as unit1Router };
export default router;
