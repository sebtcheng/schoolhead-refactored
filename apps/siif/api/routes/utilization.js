// ─── Utilization Route ────────────────────────────────────────────────────────
// POST /api/siif/utilization

import { Router } from 'express';
import { pool } from '../../../utils/db.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/utilization', authenticate, async (req, res) => {
    const { submissionId, utilizationData } = req.body;

    console.log(`\n🔬 [SIIF-API] UTILIZATION UPDATE REQ for Submission: ${submissionId}`);
    console.log(`🌐 [SIIF-API] Payload:`, JSON.stringify(utilizationData, null, 2));

    if (!submissionId || !utilizationData) {
        console.error('❌ [SIIF-API] Missing submissionId or utilizationData');
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Map intervention types back to their siif_int_id for this submission
        const intLookup = await client.query(
            'SELECT siif_int_id, intervention_type FROM siif_interventions WHERE siif_sub_id = $1',
            [submissionId]
        );

        const typeToIdMap = {};
        intLookup.rows.forEach(r => (typeToIdMap[r.intervention_type] = r.siif_int_id));

        console.log(`🔍 [SIIF-API] Found ${intLookup.rows.length} interventions for this submission.`);

        for (const [intType, quarters] of Object.entries(utilizationData)) {
            const dbIntId = typeToIdMap[intType];
            if (!dbIntId) {
                console.warn(`⚠️ [SIIF-API] Intervention type "${intType}" not found in submission. Skipping.`);
                continue;
            }
            for (const [quarter, data] of Object.entries(quarters)) {
                // Backward compatibility if data is a number
                const amount = typeof data === 'object' && data !== null ? data.amount : data;
                const status = typeof data === 'object' && data !== null ? data.status : 'Not Yet Started';
                const justification = typeof data === 'object' && data !== null ? data.justification : null;

                console.log(`💾 [SIIF-API] Upserting: ${intType} | ${quarter} | ₱${amount} | Status: ${status}`);
                await client.query(
                    `INSERT INTO siif_utilization (siif_int_id, quarter, utilized_amount, implementation_status, justification, updated_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())
                     ON CONFLICT (siif_int_id, quarter) 
                     DO UPDATE SET utilized_amount = EXCLUDED.utilized_amount, implementation_status = EXCLUDED.implementation_status, justification = EXCLUDED.justification, updated_at = NOW()`,
                    [dbIntId, quarter, parseFloat(amount) || 0, status, justification]
                );
            }
        }

        // --- BACKEND SYNCHRONIZATION ---
        // 1. Get the school_id and fiscal_year associated with this submission
        const subLookup = await client.query(
            'SELECT school_id, fiscal_year FROM siif_submissions WHERE siif_sub_id = $1',
            [submissionId]
        );
        
        if (subLookup.rows.length > 0) {
            const { school_id, fiscal_year } = subLookup.rows[0];

            // 2. Calculate the grand total of all utilized amounts for this submission
            const totalQuery = await client.query(`
                SELECT COALESCE(SUM(u.utilized_amount), 0) as grand_total
                FROM siif_utilization u
                JOIN siif_interventions i ON u.siif_int_id = i.siif_int_id
                WHERE i.siif_sub_id = $1
            `, [submissionId]);
            
            const grandTotal = totalQuery.rows[0].grand_total;
            console.log(`📊 [SIIF-API] Calculated grand total utilization: ₱${grandTotal} for School ${school_id}`);

            // 3. Update the siif_allocations table with the new spent_amount
            await client.query(`
                UPDATE siif_allocations
                SET spent_amount = $1
                WHERE school_id = $2 AND fiscal_year = $3
            `, [grandTotal, school_id, fiscal_year]);
            console.log(`✅ [SIIF-API] Synced spent_amount in siif_allocations.`);
        } else {
            console.warn(`⚠️ [SIIF-API] Could not find submission ${submissionId} in siif_submissions to sync allocation.`);
        }
        // -------------------------------

        await client.query('COMMIT');
        console.log(`✅ [SIIF-API] Utilization updated successfully for submission ${submissionId}\n`);
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔥 [SIIF-API] Utilization Update Error:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    } finally {
        client.release();
    }
});

export default router;
