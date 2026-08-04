// ─── System Utilities Route ───────────────────────────────────────────────────
// POST /api/siif/system/align-unit8

import { Router } from 'express';
import { poolSiif as pool } from '@shared/db';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/system/align-unit8', authenticate, async (req, res) => {
    const email = req.user.email;
    console.log(`🛠️ [SIIF-API] Optimization Protocol initiated by: ${email}`);

    try {
        await pool.query(`
            UPDATE siif_submissions 
            SET metadata = metadata || '{"optimized": true, "last_repair": "' || NOW() || '"}'::jsonb
            WHERE status = 'draft'
        `);
        console.log(`✅ [SIIF-API] System alignment completed for: ${email}`);
        res.json({ success: true, message: 'System optimized and aligned.' });
    } catch (err) {
        console.error('🔥 [SIIF-API] Optimization error:', err);
        res.status(500).json({ error: 'Optimization Protocol Failed' });
    }
});

export default router;
