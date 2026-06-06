// ─── JWT Authentication Middleware ───────────────────────────────────────────
import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
        const decoded = jwt.verify(token, secret);
        console.log('🔑 [SIIF-AUTH] Decoded Token:', decoded);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('❌ [SIIF-AUTH] Token verification failed:', err.message);
        return res.status(403).json({ error: 'Invalid or expired token', details: err.message });
    }
};
