// ─── Health Route ─────────────────────────────────────────────────────────────
import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'SIIF Service OK', port: process.env.SIIF_PORT || 3010, ts: new Date().toISOString() });
});

export default router;
