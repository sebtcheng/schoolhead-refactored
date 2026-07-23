// ─── Feedback Route ───────────────────────────────────────────────────────────
// POST /api/siif/feedback

import { Router } from 'express';
import { pool } from '@shared/db';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/feedback', authenticate, async (req, res) => {
    const { ratings, comment, appVersion, userName, role } = req.body;
    const email = req.user.email;

    console.log(`💬 [SIIF-API] Feedback submission from: ${email}`);

    try {
        const finalRating = ratings
            ? (ratings.easeOfUse + ratings.aesthetics + ratings.functionality) / 3
            : req.body.rating;
        const finalComment = comment || req.body.message;

        await pool.query(
            'INSERT INTO feedback (user_email, category, message, rating, created_at, metadata) VALUES ($1, $2, $3, $4, NOW(), $5)',
            [email, 'General', finalComment, finalRating, JSON.stringify({ appVersion, userName, role, ratings })]
        );
        console.log(`✅ [SIIF-API] Feedback stored for: ${email}`);
        res.json({ success: true });
    } catch (err) {
        console.error('🔥 [SIIF-API] Feedback submission error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
