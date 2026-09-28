// ─── Profile & Auth Routes ────────────────────────────────────────────────────
// PUT  /api/siif/users/update
// POST /api/siif/auth/change-password
// POST /api/siif/auth/setup-passcode

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { poolUsers } from '@shared/db';
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
        let result = await poolUsers.query(
            'UPDATE user_schoolhead SET first_name = $1, last_name = $2 WHERE LOWER(email) = LOWER($3) RETURNING *',
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
    const { currentPassword, newPassword, passcode } = req.body;
    const email = req.user.email;

    console.log(`🔐 [SIIF-API] Password change request for: ${email}`);

    try {
        if (passcode && newPassword) {
            let userResult = await poolUsers.query(
                'SELECT passcode FROM user_schoolhead WHERE LOWER(email) = LOWER($1)',
                [email]
            );
            if (userResult.rowCount === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const storedPasscode = userResult.rows[0].passcode;
            if (!storedPasscode) {
                return res.status(400).json({ error: 'No PIN/passcode setup for this account.' });
            }

            const passStr = String(storedPasscode);
            const isBcryptHash = passStr.startsWith('$2b$');
            const isMatch = isBcryptHash
                ? await bcrypt.compare(String(passcode).trim(), passStr)
                : (String(passcode).trim() === passStr.trim());

            if (!isMatch) {
                console.warn(`⚠️ [SIIF-API] Incorrect security passcode for: ${email}`);
                return res.status(401).json({ error: 'Incorrect 6-digit security passcode.' });
            }

            const hashed = await bcrypt.hash(newPassword, 10);
            await poolUsers.query(
                'UPDATE user_schoolhead SET password_hash = $1, hash_version = \'bcrypt\' WHERE LOWER(email) = LOWER($2)',
                [hashed, email]
            );

            console.log(`✅ [SIIF-API] Password updated via passcode for: ${email}`);
            return res.json({ success: true, message: 'Password updated successfully' });
        }

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }

        let userResult = await poolUsers.query(
            'SELECT password_hash FROM user_schoolhead WHERE LOWER(email) = LOWER($1)',
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
        await poolUsers.query(
            'UPDATE user_schoolhead SET password_hash = $1, hash_version = \'bcrypt\' WHERE LOWER(email) = LOWER($2)',
            [hashed, email]
        );

        console.log(`✅ [SIIF-API] Password updated for: ${email}`);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('🔥 [SIIF-API] Password change error:', err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
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
        await poolUsers.query(
            'UPDATE user_schoolhead SET passcode = $1 WHERE LOWER(email) = LOWER($2)',
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
