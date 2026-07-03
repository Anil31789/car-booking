import { Router, Request, Response } from 'express';
import { dbQuery, isFallback, memoryDb, pool } from '../db.js';
import { authenticateToken } from './auth.routes.js';

const router = Router();

// 1. GET /api/notifications
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  try {
    let list: any[] = [];
    if (isFallback) {
      list = memoryDb.notifications.filter(n => n.user_id === decoded.userId);
    } else {
      const result = await dbQuery(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
        [decoded.userId]
      );
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
  } catch (err: any) {
    console.error('Fetch Notifications Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 2. POST /api/notifications/:id/read
router.post('/:id/read', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const decoded = (req as any).user;
  try {
    if (isFallback) {
      const notif = memoryDb.notifications.find(n => n.id === id && n.user_id === decoded.userId);
      if (notif) {
        notif.is_read = true;
      }
    } else {
      await dbQuery(
        'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
        [id, decoded.userId]
      );
    }
    return res.json(true);
  } catch (err: any) {
    console.error('Mark Notification Read Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 3. POST /api/notifications/read-all
router.post('/read-all', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  try {
    if (isFallback) {
      memoryDb.notifications
        .filter(n => n.user_id === decoded.userId)
        .forEach(n => {
          n.is_read = true;
        });
    } else {
      await dbQuery(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
        [decoded.userId]
      );
    }
    return res.json(true);
  } catch (err: any) {
    console.error('Mark All Notifications Read Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
