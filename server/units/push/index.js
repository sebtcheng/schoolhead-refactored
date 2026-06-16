import express from 'express';
import webpush from 'web-push';
import authMiddleware from '../../middleware/authMiddleware.js';
import { safeQuery } from '../../utils/db.js';

const router = express.Router();

// --- WEB PUSH CONFIGURATION ---
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:helpdesk.stride@gmail.com',
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log("✅ Web Push VAPID Details Set");
} else {
  console.warn("⚠️ VAPID keys missing in .env. Push notifications will be disabled.");
}

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] WEB PUSH NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/api/vapid-public-key', (req, res) => {
    if (!vapidPublicKey) return res.status(503).json({ error: "Push service not configured" });
    res.json({ publicKey: vapidPublicKey });
});

router.post('/api/save-subscription', authMiddleware, async (req, res) => {
    const { subscription, deviceInfo } = req.body;
    const uid = req.user.uid;

    if (!subscription) return res.status(400).json({ error: "Subscription object is required" });

    try {
        await safeQuery(
            `INSERT INTO user_web_push_subscriptions (uid, subscription_json, device_info)
             VALUES ($1, $2, $3)
             ON CONFLICT (uid, subscription_json) DO UPDATE SET
                device_info = EXCLUDED.device_info,
                created_at = CURRENT_TIMESTAMP`,
            [uid, JSON.stringify(subscription), deviceInfo]
        );
        res.json({ success: true, message: "Push subscription saved successfully" });
    } catch (err) {
        console.error("❌ [Push] Failed to save subscription:", err.message);
        res.status(500).json({ error: "Database error saving subscription" });
    }
});

router.post('/api/broadcast-push', authMiddleware, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super User' && req.user.role !== 'SuperUser') {
        return res.status(403).json({ error: "Unauthorized: Admin access required for broadcasts" });
    }

    const { targetRole, title, message, url } = req.body;
    if (!targetRole) return res.status(400).json({ error: "targetRole is required (e.g., 'School Head')" });

    try {
        const result = await safeQuery(
            `SELECT s.subscription_json, u.email, u.first_name
             FROM user_web_push_subscriptions s
             JOIN users u ON s.uid = u.uid
             WHERE u.registrant_type = $1 OR u.role = $1 OR u.account_category = $1`,
            [targetRole]
        );

        const subscriptions = result.rows;
        if (subscriptions.length === 0) {
            return res.json({ success: true, message: `No active subscriptions found for role: ${targetRole}`, count: 0 });
        }

        console.log(`📣 [Push] Broadcasting to ${subscriptions.length} devices for role: ${targetRole}`);

        const payload = JSON.stringify({
            title: title || "InsightEd Notification",
            body: message || "You have a new update from Stride InsightEd.",
            icon: "/insighted_app.png",
            data: { url: url || "/" }
        });

        const pushPromises = subscriptions.map(sub => {
            return webpush.sendNotification(sub.subscription_json, payload)
                .catch(async (err) => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`🧹 [Push] Cleaning up expired token for: ${sub.email}`);
                        await safeQuery('DELETE FROM user_web_push_subscriptions WHERE subscription_json = $1', [JSON.stringify(sub.subscription_json)]);
                    } else {
                        console.error(`⚠️ [Push] Delivery failed for ${sub.email}:`, err.message);
                    }
                });
        });

        await Promise.all(pushPromises);
        res.json({ success: true, count: subscriptions.length, message: `Successfully broadcast to ${subscriptions.length} devices.` });
    } catch (err) {
        console.error("❌ [Push] Broadcast orchestrator failed:", err.message);
        res.status(500).json({ error: "Broadcast failed during database or network operation" });
    }
});

export { router as pushRouter };
export default router;
