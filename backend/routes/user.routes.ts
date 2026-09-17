import { Router, Request, Response } from 'express';
import { dbQuery, isFallback, memoryDb } from '../db.js';
import { authenticateToken, formatPhotoUrl } from './auth.routes.js';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const router = Router();
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');

// 0a. POST /api/users/me/photo (Upload or update profile photo)
router.post('/me/photo', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  const { photo } = req.body;

  if (!photo || typeof photo !== 'string') {
    return res.status(400).json({ error: 'Photo data is required' });
  }

  const match = photo.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Invalid image format. Allowed formats: JPEG, PNG, WEBP, GIF.' });
  }

  const mimeType = match[1];
  const extensionMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  const ext = extensionMap[mimeType] || '.jpg';
  const base64Data = match[3];
  const buffer = Buffer.from(base64Data, 'base64');

  // Validate file size limit: 5 MB (5,242,880 bytes)
  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image file size exceeds maximum limit of 5 MB.' });
  }

  try {
    const fileName = `user_${decoded.userId}_${Date.now()}${ext}`;
    const dirPath = join(UPLOADS_DIR, 'profile-photos');
    const filePath = join(dirPath, fileName);

    await writeFile(filePath, buffer);
    const relativePhotoUrl = `/api/uploads/profile-photos/${fileName}`;

    let oldPhotoUrl: string | null = null;

    if (isFallback) {
      const user = memoryDb.users.find(u => u.id === decoded.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      oldPhotoUrl = user.photo_url || null;
      user.photo_url = relativePhotoUrl;
    } else {
      const oldRes = await dbQuery('SELECT photo_url FROM users WHERE id = $1', [decoded.userId]);
      if (oldRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      oldPhotoUrl = oldRes.rows[0].photo_url || null;
      await dbQuery('UPDATE users SET photo_url = $1 WHERE id = $2', [relativePhotoUrl, decoded.userId]);
    }

    // Helper to resolve physical file path from photo URL
    const getUploadFilePath = (url: string | null): string | null => {
      if (!url) return null;
      const match = url.match(/(?:\/api)?\/uploads\/profile-photos\/([^/?#]+)$/);
      return match ? join(UPLOADS_DIR, 'profile-photos', match[1]) : null;
    };

    // Remove previous local photo file if it exists
    const oldFilePath = getUploadFilePath(oldPhotoUrl);
    if (oldFilePath) {
      try {
        await unlink(oldFilePath);
      } catch (e) {
        // Ignore missing old file
      }
    }

    return res.json({
      success: true,
      photoUrl: relativePhotoUrl,
      message: 'Profile photo updated successfully'
    });
  } catch (err: any) {
    console.error('Upload Photo Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 0b. DELETE /api/users/me/photo (Remove profile photo)
router.delete('/me/photo', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;

  try {
    let oldPhotoUrl: string | null = null;

    if (isFallback) {
      const user = memoryDb.users.find(u => u.id === decoded.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      oldPhotoUrl = user.photo_url || null;
      user.photo_url = null;
    } else {
      const oldRes = await dbQuery('SELECT photo_url FROM users WHERE id = $1', [decoded.userId]);
      if (oldRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      oldPhotoUrl = oldRes.rows[0].photo_url || null;
      await dbQuery('UPDATE users SET photo_url = NULL WHERE id = $1', [decoded.userId]);
    }

    const getUploadFilePath = (url: string | null): string | null => {
      if (!url) return null;
      const match = url.match(/(?:\/api)?\/uploads\/profile-photos\/([^/?#]+)$/);
      return match ? join(UPLOADS_DIR, 'profile-photos', match[1]) : null;
    };

    const oldFilePath = getUploadFilePath(oldPhotoUrl);
    if (oldFilePath) {
      try {
        await unlink(oldFilePath);
      } catch (e) {
        // Ignore missing file
      }
    }

    return res.json({
      success: true,
      photoUrl: null,
      message: 'Profile photo removed successfully'
    });
  } catch (err: any) {
    console.error('Remove Photo Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 1. GET /api/users/:driverId/reviews
router.get('/:driverId/reviews', async (req: Request, res: Response) => {
  const { driverId } = req.params;

  try {
    let reviews: any[] = [];
    
    if (isFallback) {
      reviews = memoryDb.reviews
        .filter(r => r.driver_id === driverId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      const q = `
        SELECT r.*, u.photo_url AS reviewer_photo_fallback
        FROM reviews r
        LEFT JOIN users u ON r.reviewer_id = u.id
        WHERE r.driver_id = $1
        ORDER BY r.created_at DESC
      `;
      const result = await dbQuery(q, [driverId]);
      reviews = result.rows;
    }

    const responseReviews = reviews.map(r => ({
      id: r.id,
      reviewerName: r.reviewer_name,
      reviewerPhoto: formatPhotoUrl(r.reviewer_photo || r.reviewer_photo_fallback) || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(r.reviewer_name)),
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at
    }));

    return res.json(responseReviews);
  } catch (err: any) {
    console.error('Fetch Reviews Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 2. POST /api/users/:driverId/reviews
router.post('/:driverId/reviews', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  const { driverId } = req.params;
  const { rating, comment, reviewerName, reviewerPhoto, bookingId } = req.body;

  if (!rating) return res.status(400).json({ error: 'Rating is required' });
  if (!bookingId) return res.status(400).json({ error: 'Booking ID is required' });

  // Self review check
  if (decoded.userId === driverId) {
    return res.status(400).json({ error: 'You cannot submit a review for yourself' });
  }

  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const reviewId = `rev_${driverId}_${Date.now()}`;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    let newReview: any = null;

    if (isFallback) {
      const booking = memoryDb.bookings.find(b => b.id === bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      if (booking.passenger_id !== decoded.userId) {
        return res.status(403).json({ error: 'Unauthorized: Booking does not belong to you' });
      }
      
      // We need to fetch/update booking statuses dynamically in-memory first to support completion checks
      const bookingRide = memoryDb.rides.find(r => r.id === booking.ride_id);
      if (!bookingRide || bookingRide.driver_id !== driverId) {
        return res.status(400).json({ error: 'Booking is not associated with this driver' });
      }

      // Check if it's past departure date/time to resolve dynamic completion status
      const { isDeparturePast } = await import('./booking.routes.js');
      if (booking.status === 'upcoming' && isDeparturePast(bookingRide.departure_date, bookingRide.departure_time)) {
        booking.status = 'completed';
      }

      if (booking.status !== 'completed') {
        return res.status(400).json({ error: 'You can only review completed bookings' });
      }

      // Enforce unique review per booking
      const alreadyReviewed = memoryDb.reviews.some(r => r.booking_id === bookingId);
      if (alreadyReviewed) {
        return res.status(400).json({ error: 'You have already submitted a review for this booking' });
      }

      newReview = {
        id: reviewId,
        driver_id: driverId,
        reviewer_id: decoded.userId,
        reviewer_name: reviewerName || 'Anonymous',
        reviewer_photo: reviewerPhoto || '',
        rating: numRating,
        comment: comment || '',
        created_at: new Date(),
        booking_id: bookingId
      };
      
      memoryDb.reviews.unshift(newReview);

      // Recalculate average rating for driver
      const driverReviews = memoryDb.reviews.filter(r => r.driver_id === driverId);
      const totalRating = driverReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = driverReviews.length > 0 ? Number((totalRating / driverReviews.length).toFixed(1)) : 5.0;

      // Update driver info
      const driver = memoryDb.users.find(u => u.id === driverId);
      if (driver) {
        driver.rating = avgRating;
        driver.reviews_count = driverReviews.length;
      }
    } else {
      // Postgres transactional execution
      const pgClient = await pool?.connect();
      if (!pgClient) throw new Error('Database pool not available');

      try {
        await pgClient.query('BEGIN');

        // Check booking
        const bRes = await pgClient.query(
          `SELECT b.*, r.driver_id, r.departure_date, r.departure_time
           FROM bookings b
           JOIN rides r ON b.ride_id = r.id
           WHERE b.id = $1`,
          [bookingId]
        );
        if (bRes.rows.length === 0) {
          await pgClient.query('ROLLBACK');
          return res.status(404).json({ error: 'Booking not found' });
        }
        const booking = bRes.rows[0];
        if (booking.passenger_id !== decoded.userId) {
          await pgClient.query('ROLLBACK');
          return res.status(403).json({ error: 'Unauthorized: Booking does not belong to you' });
        }
        if (booking.driver_id !== driverId) {
          await pgClient.query('ROLLBACK');
          return res.status(400).json({ error: 'Booking is not associated with this driver' });
        }

        // Check and dynamically update completion status if departed
        const { isDeparturePast } = await import('./booking.routes.js');
        let currentStatus = booking.status;
        if (currentStatus === 'upcoming' && isDeparturePast(booking.departure_date, booking.departure_time)) {
          await pgClient.query("UPDATE bookings SET status = 'completed' WHERE id = $1", [bookingId]);
          currentStatus = 'completed';
        }

        if (currentStatus !== 'completed') {
          await pgClient.query('ROLLBACK');
          return res.status(400).json({ error: 'You can only review completed bookings' });
        }

        // Enforce unique review per booking
        const revCheck = await pgClient.query('SELECT id FROM reviews WHERE booking_id = $1', [bookingId]);
        if (revCheck.rows.length > 0) {
          await pgClient.query('ROLLBACK');
          return res.status(400).json({ error: 'You have already submitted a review for this booking' });
        }

        // Insert review
        await pgClient.query(
          `INSERT INTO reviews (id, driver_id, reviewer_id, reviewer_name, reviewer_photo, rating, comment, created_at, booking_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [reviewId, driverId, decoded.userId, reviewerName || 'Anonymous', reviewerPhoto || '', numRating, comment || '', new Date(), bookingId]
        );

        // Fetch all ratings for driver to compute average
        const rCountRes = await pgClient.query(
          'SELECT COUNT(*) as count, AVG(rating) as avg FROM reviews WHERE driver_id = $1',
          [driverId]
        );
        const count = parseInt(rCountRes.rows[0].count, 10);
        const avg = Number(Number(rCountRes.rows[0].avg).toFixed(1));

        // Update driver stats in users table
        await pgClient.query(
          'UPDATE users SET rating = $1, reviews_count = $2 WHERE id = $3',
          [avg, count, driverId]
        );

        await pgClient.query('COMMIT');

        newReview = {
          id: reviewId,
          reviewer_name: reviewerName || 'Anonymous',
          reviewer_photo: reviewerPhoto || '',
          rating: numRating,
          comment: comment || '',
          created_at: todayStr
        };
      } catch (txnErr) {
        await pgClient.query('ROLLBACK');
        throw txnErr;
      } finally {
        pgClient.release();
      }
    }

    const responseReview = {
      id: newReview.id,
      reviewerName: newReview.reviewer_name,
      reviewerPhoto: newReview.reviewer_photo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(newReview.reviewer_name),
      rating: newReview.rating,
      comment: newReview.comment,
      createdAt: newReview.created_at
    };

    return res.json(responseReview);
  } catch (err: any) {
    console.error('Submit Review Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

import { pool } from '../db.js';

export default router;
