"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_routes_js_1 = require("./auth.routes.js");
const router = (0, express_1.Router)();
// 1. GET /api/users/:driverId/reviews
router.get('/:driverId/reviews', async (req, res) => {
    const { driverId } = req.params;
    try {
        let reviews = [];
        if (db_js_1.isFallback) {
            reviews = db_js_1.memoryDb.reviews
                .filter(r => r.driver_id === driverId)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        else {
            const q = `
        SELECT r.*, u.photo_url AS reviewer_photo_fallback
        FROM reviews r
        LEFT JOIN users u ON r.reviewer_id = u.id
        WHERE r.driver_id = $1
        ORDER BY r.created_at DESC
      `;
            const result = await (0, db_js_1.dbQuery)(q, [driverId]);
            reviews = result.rows;
        }
        const responseReviews = reviews.map(r => ({
            id: r.id,
            reviewerName: r.reviewer_name,
            reviewerPhoto: r.reviewer_photo || r.reviewer_photo_fallback || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(r.reviewer_name),
            rating: r.rating,
            comment: r.comment,
            createdAt: r.created_at
        }));
        return res.json(responseReviews);
    }
    catch (err) {
        console.error('Fetch Reviews Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
// 2. POST /api/users/:driverId/reviews
router.post('/:driverId/reviews', auth_routes_js_1.authenticateToken, async (req, res) => {
    const decoded = req.user;
    const { driverId } = req.params;
    const { rating, comment, reviewerName, reviewerPhoto, bookingId } = req.body;
    if (!rating)
        return res.status(400).json({ error: 'Rating is required' });
    if (!bookingId)
        return res.status(400).json({ error: 'Booking ID is required' });
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
        let newReview = null;
        if (db_js_1.isFallback) {
            const booking = db_js_1.memoryDb.bookings.find(b => b.id === bookingId);
            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }
            if (booking.passenger_id !== decoded.userId) {
                return res.status(403).json({ error: 'Unauthorized: Booking does not belong to you' });
            }
            // We need to fetch/update booking statuses dynamically in-memory first to support completion checks
            const bookingRide = db_js_1.memoryDb.rides.find(r => r.id === booking.ride_id);
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
            const alreadyReviewed = db_js_1.memoryDb.reviews.some(r => r.booking_id === bookingId);
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
            db_js_1.memoryDb.reviews.unshift(newReview);
            // Recalculate average rating for driver
            const driverReviews = db_js_1.memoryDb.reviews.filter(r => r.driver_id === driverId);
            const totalRating = driverReviews.reduce((sum, r) => sum + r.rating, 0);
            const avgRating = driverReviews.length > 0 ? Number((totalRating / driverReviews.length).toFixed(1)) : 5.0;
            // Update driver info
            const driver = db_js_1.memoryDb.users.find(u => u.id === driverId);
            if (driver) {
                driver.rating = avgRating;
                driver.reviews_count = driverReviews.length;
            }
        }
        else {
            // Postgres transactional execution
            const pgClient = await db_js_2.pool?.connect();
            if (!pgClient)
                throw new Error('Database pool not available');
            try {
                await pgClient.query('BEGIN');
                // Check booking
                const bRes = await pgClient.query(`SELECT b.*, r.driver_id, r.departure_date, r.departure_time
           FROM bookings b
           JOIN rides r ON b.ride_id = r.id
           WHERE b.id = $1`, [bookingId]);
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
                await pgClient.query(`INSERT INTO reviews (id, driver_id, reviewer_id, reviewer_name, reviewer_photo, rating, comment, created_at, booking_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [reviewId, driverId, decoded.userId, reviewerName || 'Anonymous', reviewerPhoto || '', numRating, comment || '', new Date(), bookingId]);
                // Fetch all ratings for driver to compute average
                const rCountRes = await pgClient.query('SELECT COUNT(*) as count, AVG(rating) as avg FROM reviews WHERE driver_id = $1', [driverId]);
                const count = parseInt(rCountRes.rows[0].count, 10);
                const avg = Number(Number(rCountRes.rows[0].avg).toFixed(1));
                // Update driver stats in users table
                await pgClient.query('UPDATE users SET rating = $1, reviews_count = $2 WHERE id = $3', [avg, count, driverId]);
                await pgClient.query('COMMIT');
                newReview = {
                    id: reviewId,
                    reviewer_name: reviewerName || 'Anonymous',
                    reviewer_photo: reviewerPhoto || '',
                    rating: numRating,
                    comment: comment || '',
                    created_at: todayStr
                };
            }
            catch (txnErr) {
                await pgClient.query('ROLLBACK');
                throw txnErr;
            }
            finally {
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
    }
    catch (err) {
        console.error('Submit Review Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
const db_js_2 = require("../db.js");
exports.default = router;
