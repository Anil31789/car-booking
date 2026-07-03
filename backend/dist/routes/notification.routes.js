"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_routes_js_1 = require("./auth.routes.js");
const router = (0, express_1.Router)();
// 1. GET /api/notifications
router.get('/', auth_routes_js_1.authenticateToken, async (req, res) => {
    const decoded = req.user;
    try {
        let list = [];
        if (db_js_1.isFallback) {
            list = db_js_1.memoryDb.notifications.filter(n => n.user_id === decoded.userId);
        }
        else {
            const result = await (0, db_js_1.dbQuery)('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [decoded.userId]);
            list = result.rows;
        }
        return res.json(list.map(n => ({
            id: n.id,
            userId: n.user_id,
            title: n.title,
            message: n.message,
            type: n.type,
            isRead: n.is_read,
            createdAt: n.created_at,
            bookingId: n.booking_id
        })));
    }
    catch (err) {
        console.error('Fetch Notifications Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
// 2. POST /api/notifications/:id/read
router.post('/:id/read', auth_routes_js_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const decoded = req.user;
    try {
        if (db_js_1.isFallback) {
            const notif = db_js_1.memoryDb.notifications.find(n => n.id === id && n.user_id === decoded.userId);
            if (notif) {
                notif.is_read = true;
            }
        }
        else {
            await (0, db_js_1.dbQuery)('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [id, decoded.userId]);
        }
        return res.json(true);
    }
    catch (err) {
        console.error('Mark Notification Read Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
// 3. POST /api/notifications/read-all
router.post('/read-all', auth_routes_js_1.authenticateToken, async (req, res) => {
    const decoded = req.user;
    try {
        if (db_js_1.isFallback) {
            db_js_1.memoryDb.notifications
                .filter(n => n.user_id === decoded.userId)
                .forEach(n => {
                n.is_read = true;
            });
        }
        else {
            await (0, db_js_1.dbQuery)('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [decoded.userId]);
        }
        return res.json(true);
    }
    catch (err) {
        console.error('Mark All Notifications Read Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
