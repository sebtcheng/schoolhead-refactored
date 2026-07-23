// ─── Settings Routes ──────────────────────────────────────────────────────────
// GET  /api/siif/settings/deadline  — Public, for UI timers
// PUT  /api/siif/settings/deadline  — Admin only

import { Router } from 'express';
import { pool } from '@shared/db';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// GET /api/siif/settings/deadline
router.get('/settings/deadline', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT key, value FROM settings WHERE key IN ('siif_deadline', 'siif_form_start', 'siif_form_end')"
        );
        const settings = {};
        result.rows.forEach(row => (settings[row.key] = row.value));

        const deadline = settings['siif_form_end'] || settings['siif_deadline'];
        const start = settings['siif_form_start'];

        console.log(`⏰ [SIIF-API] Deadline request: End=${deadline || 'NOT SET'} | Start=${start || 'NOT SET'}`);
        res.json({ deadline, start, serverTime: new Date().toISOString() });
    } catch (err) {
        console.error('❌ [SIIF-API] Error fetching deadline:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/siif/settings/deadline
router.put('/settings/deadline', authenticate, async (req, res) => {
    const { deadline } = req.body;

    console.log(`\n🛡️ [SIIF-SETTINGS] DEADLINE UPDATE ATTEMPT`);
    console.log(`👤 User: ${req.user?.email} | Role: ${req.user?.role}`);
    console.log(`📅 Proposed Value: ${deadline}`);

    if (!deadline) {
        return res.status(400).json({ error: 'Deadline is required' });
    }

    try {
        const dateObj = new Date(deadline);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ error: 'Invalid date format. Use ISO 8601.' });
        }

        await pool.query(
            "INSERT INTO settings (key, value) VALUES ('siif_form_end', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [deadline]
        );
        console.log(`✅ [SIIF-SETTINGS] Global Deadline successfully updated to: ${deadline}`);
        res.json({ success: true, deadline });
    } catch (err) {
        console.error('🔥 [SIIF-SETTINGS] Critical failure during deadline update:', err);
        res.status(500).json({ error: 'Failed to update settings', details: err.message });
    }
});

export default router;
