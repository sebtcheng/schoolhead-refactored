// ─── Profile & Auth Routes ────────────────────────────────────────────────────
// PUT  /api/siif/users/update
// POST /api/siif/auth/change-password
// POST /api/siif/auth/setup-passcode

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '@shared/db';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// PUT /api/siif/users/update — Update profile info
router.put('/users/update', authenticate, async (req, res) => {
    const { firstName, lastName } = req.body;
    const email = req.user.email;

    console.log(`👤 [SIIF-API] Profile update request for: ${email}`);

    if (!firstName || !lastName) {
        return res.status(400).json({ error: 'First name and last name are required' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET first_name = $1, last_name = $2 WHERE LOWER(email) = LOWER($3) RETURNING *',
            [firstName, lastName, email]
        );
        if (result.rowCount === 0) {
            console.error(`❌ [SIIF-API] User not found during update: ${email}`);
            return res.status(404).json({ error: 'User not found' });
        }
        console.log(`✅ [SIIF-API] Profile updated for: ${email}`);
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error('🔥 [SIIF-API] User update error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/siif/auth/change-password
router.post('/auth/change-password', authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const email = req.user.email;

    console.log(`🔐 [SIIF-API] Password change request for: ${email}`);

    try {
        const userResult = await pool.query(
            'SELECT password_hash FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );
        if (userResult.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
        if (!isMatch) {
            console.warn(`⚠️ [SIIF-API] Incorrect current password for: ${email}`);
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2)',
            [hashed, email]
        );
        console.log(`✅ [SIIF-API] Password updated for: ${email}`);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('🔥 [SIIF-API] Password change error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/siif/auth/setup-passcode — Setup 6-digit PIN
router.post('/auth/setup-passcode', authenticate, async (req, res) => {
    const { passcode } = req.body;
    const email = req.user.email;

    console.log(`🔢 [SIIF-API] Passcode setup request for: ${email}`);

    if (!passcode || passcode.length !== 6) {
        return res.status(400).json({ error: '6-digit passcode is required' });
    }

    try {
        const hashed = await bcrypt.hash(passcode, 10);
        await pool.query(
            'UPDATE users SET passcode = $1 WHERE LOWER(email) = LOWER($2)',
            [hashed, email]
        );
        console.log(`✅ [SIIF-API] Passcode updated for: ${email}`);
        res.json({ success: true, message: 'Passcode updated successfully' });
    } catch (err) {
        console.error('🔥 [SIIF-API] Passcode setup error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
