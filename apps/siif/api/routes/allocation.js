// ─── Allocation Route ─────────────────────────────────────────────────────────
// GET /api/siif/allocation/:schoolId

import { Router } from 'express';
import { poolSiif as pool } from '@shared/db';
import { authenticate } from '../middleware/authenticate.js';
import { resolveSchoolId } from '../helpers/resolveSchoolId.js';

const router = Router();

router.get('/allocation/:schoolId', authenticate, async (req, res) => {
    const { schoolId } = req.params;
    const fiscalYear = req.query.year || new Date().getFullYear();
    const finalSchoolId = await resolveSchoolId(schoolId, req.user);

    try {
        const result = await pool.query(
            'SELECT * FROM siif_allocations WHERE school_id = $1 AND fiscal_year = $2',
            [finalSchoolId, fiscalYear]
        );
        if (result.rows.length === 0) {
            return res.json({
                school_id: finalSchoolId,
                fiscal_year: fiscalYear,
                allocation_amount: '0.00',
                spent_amount: '0.00',
                remaining_balance: '0.00',
            });
        }
        const row = result.rows[0];
        return res.json({
            ...row,
            remaining_balance: (parseFloat(row.allocation_amount) - parseFloat(row.spent_amount)).toFixed(2),
        });
    } catch (err) {
        console.error('[SIIF-API] Error fetching allocation:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
