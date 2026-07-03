"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDeparturePast = isDeparturePast;
exports.autoUpdateBookingStatusesInMemory = autoUpdateBookingStatusesInMemory;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_routes_js_1 = require("./auth.routes.js");
const router = (0, express_1.Router)();
function isDeparturePast(departureDateStr, departureTimeStr) {
    try {
        const [year, month, day] = departureDateStr.split('-').map(Number);
        const [hours, minutes] = departureTimeStr.split(':').map(Number);
        const depDate = new Date(year, month - 1, day, hours, minutes);
        return depDate < new Date();
    }
    catch (e) {
        return false;
    }
}
function autoUpdateBookingStatusesInMemory() {
    for (const b of db_js_1.memoryDb.bookings) {
        if (b.status === 'upcoming') {
            const ride = db_js_1.memoryDb.rides.find(r => r.id === b.ride_id);
            if (ride && isDeparturePast(ride.departure_date, ride.departure_time)) {
                b.status = 'completed';
            }
        }
    }
}
async function autoUpdateBookingStatusesPg() {
    if (db_js_1.isFallback) {
        autoUpdateBookingStatusesInMemory();
    }
    else {
        try {
            const q = `
        UPDATE bookings 
        SET status = 'completed'
        WHERE status = 'upcoming' 
          AND id IN (
            SELECT b.id 
            FROM bookings b
            JOIN rides r ON b.ride_id = r.id
            WHERE b.status = 'upcoming' 
              AND TO_TIMESTAMP(r.departure_date || ' ' || r.departure_time, 'YYYY-MM-DD HH24:MI') < CURRENT_TIMESTAMP
          )
      `;
            await (0, db_js_1.dbQuery)(q);
        }
        catch (err) {
            console.error('Error auto-updating PG booking statuses:', err);
        }
    }
}
// 1. GET /api/bookings/user/:passengerId
router.get('/user/:passengerId', auth_routes_js_1.authenticateToken, async (req, res) => {
    const { passengerId } = req.params;
    try {
        await autoUpdateBookingStatusesPg();
        let list = [];
        if (db_js_1.isFallback) {
            list = db_js_1.memoryDb.bookings
                .filter(b => b.passenger_id === passengerId)
                .map(b => hydrateBookingInMemory(b));
        }
        else {
            const q = `
        SELECT b.*, 
               r.start_location, r.destination, r.departure_date, r.departure_time, r.arrival_time, r.price_per_seat,
               u.name AS driver_name, u.photo_url AS driver_photo, u.rating AS driver_rating, u.phone AS driver_phone,
               v.model AS vehicle_model, v.number_plate AS vehicle_plate, v.type AS vehicle_type, v.color AS vehicle_color
        FROM bookings b
        JOIN rides r ON b.ride_id = r.id
        JOIN users u ON r.driver_id = u.id
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        WHERE b.passenger_id = $1
        ORDER BY b.booking_date DESC
      `;
            const result = await (0, db_js_1.dbQuery)(q, [passengerId]);
            list = result.rows.map((row) => formatBookingRow(row));
        }
        return res.json(list);
    }
    catch (err) {
        console.error('Fetch Bookings Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
// 2. POST /api/bookings (Book a Ride)
router.post('/', auth_routes_js_1.authenticateToken, async (req, res) => {
    const decoded = req.user;
    const { rideId, seatsBooked, paymentMethod, selectedSeats } = req.body;
    if (!rideId || !seatsBooked) {
        return res.status(400).json({ error: 'Ride ID and seats booked count are required' });
    }
    const seats = Number(seatsBooked);
    if (isNaN(seats) || seats <= 0) {
        return res.status(400).json({ error: 'Seats booked must be a positive integer > 0' });
    }
    const bookingId = `bk_${Date.now()}`;
    const todayStr = new Date().toISOString().split('T')[0];
    try {
        if (paymentMethod && !['UPI', 'Card', 'Wallet', 'Cash'].includes(paymentMethod)) {
            return res.status(400).json({ error: 'Invalid payment method' });
        }
        if (db_js_1.isFallback) {
            const ride = db_js_1.memoryDb.rides.find(r => r.id === rideId);
            if (!ride)
                return res.status(404).json({ error: 'Ride not found' });
            // Prevent booking rides that have already departed
            if (isDeparturePast(ride.departure_date, ride.departure_time)) {
                return res.status(400).json({ error: 'Cannot book seats on a ride that has already departed' });
            }
            // Driver booking own ride check
            if (ride.driver_id === decoded.userId) {
                return res.status(400).json({ error: 'Drivers cannot book seats on their own rides' });
            }
            // Duplicate booking check
            const duplicate = db_js_1.memoryDb.bookings.some(b => b.ride_id === rideId && b.passenger_id === decoded.userId && b.status !== 'cancelled');
            if (duplicate) {
                return res.status(400).json({ error: 'You have already booked seats on this ride' });
            }
            if (ride.available_seats < seats) {
                return res.status(400).json({ error: 'Not enough seats available' });
            }
            const passenger = db_js_1.memoryDb.users.find(u => u.id === decoded.userId);
            if (!passenger)
                return res.status(404).json({ error: 'Passenger profile not found' });
            const price = ride.price_per_seat * seats;
            // DO NOT update available seats until driver accepts
            const newBooking = {
                id: bookingId,
                ride_id: rideId,
                passenger_id: decoded.userId,
                seats_booked: seats,
                total_price: price,
                status: 'pending', // Pending driver approval
                booking_date: todayStr,
                payment_method: paymentMethod || 'UPI',
                payment_status: 'Pending',
                selected_seats: selectedSeats || []
            };
            db_js_1.memoryDb.bookings.unshift(newBooking);
            const passengerName = passenger ? passenger.name : 'A passenger';
            (0, db_js_1.createNotification)(ride.driver_id, 'New Booking Request', `Passenger ${passengerName} has requested to book ${seats} seat(s) on your ride from ${ride.start_location} to ${ride.destination}.`, 'booking_request', bookingId);
            return res.json(hydrateBookingInMemory(newBooking));
        }
        else {
            const pgClient = await db_js_1.pool?.connect();
            if (!pgClient)
                return res.status(500).json({ error: 'Database pool not available' });
            try {
                await pgClient.query('BEGIN');
                // Load ride with lock
                const rRes = await pgClient.query('SELECT * FROM rides WHERE id = $1 FOR UPDATE', [rideId]);
                if (rRes.rows.length === 0) {
                    await pgClient.query('ROLLBACK');
                    return res.status(404).json({ error: 'Ride not found' });
                }
                const ride = rRes.rows[0];
                // Prevent booking rides that have already departed
                if (isDeparturePast(ride.departure_date, ride.departure_time)) {
                    await pgClient.query('ROLLBACK');
                    return res.status(400).json({ error: 'Cannot book seats on a ride that has already departed' });
                }
                // Driver booking own ride check
                if (ride.driver_id === decoded.userId) {
                    await pgClient.query('ROLLBACK');
                    return res.status(400).json({ error: 'Drivers cannot book seats on their own rides' });
                }
                // Duplicate booking check
                const dupRes = await pgClient.query("SELECT id FROM bookings WHERE ride_id = $1 AND passenger_id = $2 AND status != 'cancelled'", [rideId, decoded.userId]);
                if (dupRes.rows.length > 0) {
                    await pgClient.query('ROLLBACK');
                    return res.status(400).json({ error: 'You have already booked seats on this ride' });
                }
                if (ride.available_seats < seats) {
                    await pgClient.query('ROLLBACK');
                    return res.status(400).json({ error: 'Not enough seats available' });
                }
                const price = ride.price_per_seat * seats;
                // DO NOT update available seats until driver accepts
                // Insert Booking
                await pgClient.query(`INSERT INTO bookings (id, ride_id, passenger_id, seats_booked, total_price, status, booking_date, payment_method, payment_status, selected_seats)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [bookingId, rideId, decoded.userId, seats, price, 'pending', todayStr, paymentMethod || 'UPI', 'Pending', selectedSeats || []]);
                await pgClient.query('COMMIT');
                // Trigger Notification
                const passengerRes = await (0, db_js_1.dbQuery)('SELECT name FROM users WHERE id = $1', [decoded.userId]);
                const passengerName = passengerRes.rows.length > 0 ? passengerRes.rows[0].name : 'A passenger';
                await (0, db_js_1.createNotification)(ride.driver_id, 'New Booking Request', `Passenger ${passengerName} has requested to book ${seats} seat(s) on your ride from ${ride.start_location} to ${ride.destination}.`, 'booking_request', bookingId);
                // Fetch fully hydrated booking object
                const fullB = await pgClient.query(`SELECT b.*, 
                 r.start_location, r.destination, r.departure_date, r.departure_time, r.arrival_time, r.price_per_seat,
                 u.name AS driver_name, u.photo_url AS driver_photo, u.rating AS driver_rating, u.phone AS driver_phone,
                 v.model AS vehicle_model, v.number_plate AS vehicle_plate, v.type AS vehicle_type, v.color AS vehicle_color
          FROM bookings b
          JOIN rides r ON b.ride_id = r.id
          JOIN users u ON r.driver_id = u.id
          LEFT JOIN vehicles v ON r.vehicle_id = v.id
          WHERE b.id = $1`, [bookingId]);
                return res.json(formatBookingRow(fullB.rows[0]));
            }
            catch (txnErr) {
                await pgClient.query('ROLLBACK');
                throw txnErr;
            }
            finally {
                pgClient.release();
            }
        }
    }
    catch (err) {
        console.error('Create Booking Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
// 3. POST /api/bookings/:id/cancel
router.post('/:id/cancel', auth_routes_js_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (db_js_1.isFallback) {
            const booking = db_js_1.memoryDb.bookings.find(b => b.id === id);
            if (!booking)
                return res.status(404).json({ error: 'Booking not found' });
            if (booking.status === 'cancelled') {
                return res.status(400).json({ error: 'Booking is already cancelled' });
            }
            const ride = db_js_1.memoryDb.rides.find(r => r.id === booking.ride_id);
            if (!ride)
                return res.status(404).json({ error: 'Ride not found' });
            // Block cancellation if booking is completed or departed
            if (booking.status === 'completed' || isDeparturePast(ride.departure_date, ride.departure_time)) {
                return res.status(400).json({ error: 'Cannot cancel a completed or departed ride booking' });
            }
            const prevStatus = booking.status;
            booking.status = 'cancelled';
            booking.payment_status = 'Refunded';
            // Restore seats ONLY if it was accepted/upcoming
            if (prevStatus === 'upcoming') {
                ride.available_seats = Math.min(ride.total_seats, ride.available_seats + booking.seats_booked);
            }
            return res.json(true);
        }
        else {
            const pgClient = await db_js_1.pool?.connect();
            if (!pgClient)
                throw new Error('Database pool not available');
            try {
                await pgClient.query('BEGIN');
                const bRes = await pgClient.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
                if (bRes.rows.length === 0) {
                    await pgClient.query('ROLLBACK');
                    return res.status(404).json({ error: 'Booking not found' });
                }
                const booking = bRes.rows[0];
                if (booking.status === 'cancelled') {
                    await pgClient.query('ROLLBACK');
                    return res.status(400).json({ error: 'Booking is already cancelled' });
                }
                const rRes = await pgClient.query('SELECT * FROM rides WHERE id = $1', [booking.ride_id]);
                if (rRes.rows.length === 0) {
                    await pgClient.query('ROLLBACK');
                    return res.status(404).json({ error: 'Ride not found' });
                }
                const ride = rRes.rows[0];
                // Block cancellation if booking is completed or departed
                if (booking.status === 'completed' || isDeparturePast(ride.departure_date, ride.departure_time)) {
                    await pgClient.query('ROLLBACK');
                    return res.status(400).json({ error: 'Cannot cancel a completed or departed ride booking' });
                }
                // Update booking status
                await pgClient.query("UPDATE bookings SET status = 'cancelled', payment_status = 'Refunded' WHERE id = $1", [id]);
                // Restore seats ONLY if it was accepted/upcoming
                if (booking.status === 'upcoming') {
                    await pgClient.query("UPDATE rides SET available_seats = LEAST(total_seats, available_seats + $1) WHERE id = $2", [booking.seats_booked, booking.ride_id]);
                }
                await pgClient.query('COMMIT');
                return res.json(true);
            }
            catch (txnErr) {
                await pgClient.query('ROLLBACK');
                throw txnErr;
            }
            finally {
                pgClient.release();
            }
        }
    }
    catch (err) {
        console.error('Cancel Booking Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
// 4. GET /api/bookings/driver (Fetch incoming requests for driver)
router.get('/driver', auth_routes_js_1.authenticateToken, async (req, res) => {
    const decoded = req.user;
    try {
        await autoUpdateBookingStatusesPg();
        if (db_js_1.isFallback) {
            const driverRideIds = db_js_1.memoryDb.rides.filter(r => r.driver_id === decoded.userId).map(r => r.id);
            const requests = db_js_1.memoryDb.bookings.filter(b => driverRideIds.includes(b.ride_id));
            const formatted = requests.map(b => {
                const passenger = db_js_1.memoryDb.users.find(u => u.id === b.passenger_id);
                const ride = db_js_1.memoryDb.rides.find(r => r.id === b.ride_id);
                return {
                    id: b.id,
                    passengerName: passenger ? passenger.name : 'Passenger',
                    passengerPhoto: passenger ? passenger.photo_url : '',
                    seats: b.seats_booked,
                    rideId: b.ride_id,
                    rideRoute: `${ride.start_location} to ${ride.destination}`,
                    status: b.status,
                    totalPrice: b.total_price,
                    paymentMethod: b.payment_method,
                    paymentStatus: b.payment_status,
                    departureDate: ride.departure_date,
                    departureTime: ride.departure_time
                };
            });
            return res.json(formatted);
        }
        else {
            const q = `
        SELECT b.*, u.name AS passenger_name, u.photo_url AS passenger_photo, 
               r.start_location, r.destination, r.departure_date, r.departure_time
        FROM bookings b
        JOIN rides r ON b.ride_id = r.id
        JOIN users u ON b.passenger_id = u.id
        WHERE r.driver_id = $1
        ORDER BY b.booking_date DESC
      `;
            const result = await (0, db_js_1.dbQuery)(q, [decoded.userId]);
            const formatted = result.rows.map((row) => ({
                id: row.id,
                passengerName: row.passenger_name,
                passengerPhoto: row.passenger_photo || '',
                seats: row.seats_booked,
                rideId: row.ride_id,
                rideRoute: `${row.start_location} to ${row.destination}`,
                status: row.status,
                totalPrice: row.total_price,
                paymentMethod: row.payment_method,
                paymentStatus: row.payment_status,
                departureDate: row.departure_date,
                departureTime: row.departure_time
            }));
            return res.json(formatted);
        }
    }
    catch (err) {
        console.error('Fetch Driver Bookings Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
// 5. POST /api/bookings/:id/accept
router.post('/:id/accept', auth_routes_js_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const decoded = req.user;
    try {
        if (db_js_1.isFallback) {
            const booking = db_js_1.memoryDb.bookings.find(b => b.id === id);
            if (!booking)
                return res.status(404).json({ error: 'Booking not found' });
            if (booking.status !== 'pending')
                return res.status(400).json({ error: 'Booking is not pending approval' });
            const ride = db_js_1.memoryDb.rides.find(r => r.id === booking.ride_id);
            if (!ride)
                return res.status(404).json({ error: 'Ride not found' });
            // Driver ownership check
            if (ride.driver_id !== decoded.userId) {
                return res.status(403).json({ error: 'Unauthorized: Only the ride driver can accept bookings' });
            }
            if (ride.available_seats < booking.seats_booked) {
                booking.status = 'cancelled';
                booking.payment_status = 'Refunded';
                return res.status(400).json({ error: 'Not enough seats available' });
            }
            booking.status = 'upcoming';
            booking.payment_status = 'Pending';
            ride.available_seats = Math.max(0, ride.available_seats - booking.seats_booked);
            const driver = db_js_1.memoryDb.users.find(u => u.id === decoded.userId);
            const driverName = driver ? driver.name : 'The driver';
            (0, db_js_1.createNotification)(booking.passenger_id, 'Booking Approved', `Your booking request for the ride from ${ride.start_location} to ${ride.destination} has been accepted by ${driverName}.`, 'booking_accepted', id);
            return res.json(true);
        }
        else {
            const pgClient = await db_js_1.pool?.connect();
            if (!pgClient)
                return res.status(500).json({ error: 'DB pool offline' });
            try {
                await pgClient.query('BEGIN');
                const bRes = await pgClient.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
                if (bRes.rows.length === 0) {
                    await pgClient.query('ROLLBACK');
                    return res.status(404).json({ error: 'Booking not found' });
                }
                const booking = bRes.rows[0];
                if (booking.status !== 'pending') {
                    await pgClient.query('ROLLBACK');
                    return res.status(400).json({ error: 'Booking is not pending approval' });
                }
                const rRes = await pgClient.query('SELECT * FROM rides WHERE id = $1 FOR UPDATE', [booking.ride_id]);
                const ride = rRes.rows[0];
                // Driver ownership check
                if (ride.driver_id !== decoded.userId) {
                    await pgClient.query('ROLLBACK');
                    return res.status(403).json({ error: 'Unauthorized: Only the ride driver can accept bookings' });
                }
                if (ride.available_seats < booking.seats_booked) {
                    await pgClient.query('ROLLBACK');
                    return res.status(400).json({ error: 'Not enough seats available' });
                }
                await pgClient.query("UPDATE bookings SET status = 'upcoming', payment_status = 'Pending' WHERE id = $1", [id]);
                await pgClient.query("UPDATE rides SET available_seats = available_seats - $1 WHERE id = $2", [booking.seats_booked, booking.ride_id]);
                await pgClient.query('COMMIT');
                const driverRes = await (0, db_js_1.dbQuery)('SELECT name FROM users WHERE id = $1', [decoded.userId]);
                const driverName = driverRes.rows.length > 0 ? driverRes.rows[0].name : 'The driver';
                await (0, db_js_1.createNotification)(booking.passenger_id, 'Booking Approved', `Your booking request for the ride from ${ride.start_location} to ${ride.destination} has been accepted by ${driverName}.`, 'booking_accepted', id);
                return res.json(true);
            }
            catch (err) {
                await pgClient.query('ROLLBACK');
                throw err;
            }
            finally {
                pgClient.release();
            }
        }
    }
    catch (err) {
        console.error('Accept Booking Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
// 6. POST /api/bookings/:id/reject
router.post('/:id/reject', auth_routes_js_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const decoded = req.user;
    try {
        if (db_js_1.isFallback) {
            const booking = db_js_1.memoryDb.bookings.find(b => b.id === id);
            if (!booking)
                return res.status(404).json({ error: 'Booking not found' });
            if (booking.status !== 'pending')
                return res.status(400).json({ error: 'Booking is not pending approval' });
            const ride = db_js_1.memoryDb.rides.find(r => r.id === booking.ride_id);
            if (!ride)
                return res.status(404).json({ error: 'Ride not found' });
            // Driver ownership check
            if (ride.driver_id !== decoded.userId) {
                return res.status(403).json({ error: 'Unauthorized: Only the ride driver can reject bookings' });
            }
            booking.status = 'cancelled';
            booking.payment_status = 'Refunded';
            const driver = db_js_1.memoryDb.users.find(u => u.id === decoded.userId);
            const driverName = driver ? driver.name : 'The driver';
            (0, db_js_1.createNotification)(booking.passenger_id, 'Booking Rejected', `Your booking request for the ride from ${ride.start_location} to ${ride.destination} was rejected by the driver (${driverName}).`, 'booking_rejected', id);
            return res.json(true);
        }
        else {
            const pgClient = await db_js_1.pool?.connect();
            if (!pgClient)
                return res.status(500).json({ error: 'DB pool offline' });
            try {
                await pgClient.query('BEGIN');
                const bRes = await pgClient.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
                if (bRes.rows.length === 0) {
                    await pgClient.query('ROLLBACK');
                    return res.status(404).json({ error: 'Booking not found' });
                }
                const booking = bRes.rows[0];
                if (booking.status !== 'pending') {
                    await pgClient.query('ROLLBACK');
                    return res.status(400).json({ error: 'Booking is not pending approval' });
                }
                const rRes = await pgClient.query('SELECT * FROM rides WHERE id = $1', [booking.ride_id]);
                const ride = rRes.rows[0];
                // Driver ownership check
                if (ride.driver_id !== decoded.userId) {
                    await pgClient.query('ROLLBACK');
                    return res.status(403).json({ error: 'Unauthorized: Only the ride driver can reject bookings' });
                }
                await pgClient.query("UPDATE bookings SET status = 'cancelled', payment_status = 'Refunded' WHERE id = $1", [id]);
                await pgClient.query('COMMIT');
                const driverRes = await (0, db_js_1.dbQuery)('SELECT name FROM users WHERE id = $1', [decoded.userId]);
                const driverName = driverRes.rows.length > 0 ? driverRes.rows[0].name : 'The driver';
                await (0, db_js_1.createNotification)(booking.passenger_id, 'Booking Rejected', `Your booking request for the ride from ${ride.start_location} to ${ride.destination} was rejected by the driver (${driverName}).`, 'booking_rejected', id);
                return res.json(true);
            }
            catch (err) {
                await pgClient.query('ROLLBACK');
                throw err;
            }
            finally {
                pgClient.release();
            }
        }
    }
    catch (err) {
        console.error('Reject Booking Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
// 7. POST /api/bookings/:id/mark-paid
router.post('/:id/mark-paid', auth_routes_js_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const decoded = req.user;
    try {
        if (db_js_1.isFallback) {
            const booking = db_js_1.memoryDb.bookings.find(b => b.id === id);
            if (!booking)
                return res.status(404).json({ error: 'Booking not found' });
            const ride = db_js_1.memoryDb.rides.find(r => r.id === booking.ride_id);
            if (!ride)
                return res.status(404).json({ error: 'Ride not found' });
            // Verify driver ownership
            if (ride.driver_id !== decoded.userId) {
                return res.status(403).json({ error: 'Unauthorized: Only the ride driver can mark payment as paid' });
            }
            // Verify ride has completed
            if (!isDeparturePast(ride.departure_date, ride.departure_time)) {
                return res.status(400).json({ error: 'Cannot mark payment as paid before the ride departs' });
            }
            booking.payment_status = 'Paid';
            return res.json(true);
        }
        else {
            const pgClient = await db_js_1.pool?.connect();
            if (!pgClient)
                return res.status(500).json({ error: 'DB pool offline' });
            try {
                await pgClient.query('BEGIN');
                const bRes = await pgClient.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
                if (bRes.rows.length === 0) {
                    await pgClient.query('ROLLBACK');
                    return res.status(404).json({ error: 'Booking not found' });
                }
                const booking = bRes.rows[0];
                const rRes = await pgClient.query('SELECT * FROM rides WHERE id = $1', [booking.ride_id]);
                if (rRes.rows.length === 0) {
                    await pgClient.query('ROLLBACK');
                    return res.status(404).json({ error: 'Ride not found' });
                }
                const ride = rRes.rows[0];
                // Verify driver ownership
                if (ride.driver_id !== decoded.userId) {
                    await pgClient.query('ROLLBACK');
                    return res.status(403).json({ error: 'Unauthorized: Only the ride driver can mark payment as paid' });
                }
                // Verify ride has completed
                if (!isDeparturePast(ride.departure_date, ride.departure_time)) {
                    await pgClient.query('ROLLBACK');
                    return res.status(400).json({ error: 'Cannot mark payment as paid before the ride departs' });
                }
                await pgClient.query("UPDATE bookings SET payment_status = 'Paid' WHERE id = $1", [id]);
                await pgClient.query('COMMIT');
                return res.json(true);
            }
            catch (err) {
                await pgClient.query('ROLLBACK');
                throw err;
            }
            finally {
                pgClient.release();
            }
        }
    }
    catch (err) {
        console.error('Mark Paid Booking Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});
// Helper formatting row mappings
function formatBookingRow(row) {
    return {
        id: row.id,
        rideId: row.ride_id,
        passengerId: row.passenger_id,
        seatsBooked: row.seats_booked,
        totalPrice: row.total_price,
        status: row.status,
        bookingDate: row.booking_date,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        selectedSeats: row.selected_seats || [],
        ride: {
            id: row.ride_id,
            startLocation: row.start_location,
            destination: row.destination,
            departureDate: row.departure_date,
            departureTime: row.departure_time,
            arrivalTime: row.arrival_time,
            pricePerSeat: row.price_per_seat,
            driverName: row.driver_name,
            driverPhoto: row.driver_photo,
            driverRating: Number(row.driver_rating),
            driverPhone: row.driver_phone,
            vehicle: {
                model: row.vehicle_model,
                numberPlate: row.vehicle_plate,
                type: row.vehicle_type,
                color: row.vehicle_color
            }
        }
    };
}
function hydrateBookingInMemory(b) {
    const ride = db_js_1.memoryDb.rides.find(r => r.id === b.ride_id);
    let hydratedRide = undefined;
    if (ride) {
        const driver = db_js_1.memoryDb.users.find(u => u.id === ride.driver_id);
        const vehicle = db_js_1.memoryDb.vehicles.find(v => v.id === ride.vehicle_id);
        hydratedRide = {
            id: ride.id,
            startLocation: ride.start_location,
            destination: ride.destination,
            departureDate: ride.departure_date,
            departureTime: ride.departure_time,
            arrivalTime: ride.arrival_time,
            pricePerSeat: ride.price_per_seat,
            driverName: driver ? driver.name : '',
            driverPhoto: driver ? driver.photo_url : '',
            driverRating: driver ? Number(driver.rating) : 5.0,
            driverPhone: driver ? driver.phone : '',
            vehicle: vehicle ? {
                model: vehicle.model,
                numberPlate: vehicle.number_plate,
                type: vehicle.type,
                color: vehicle.color
            } : undefined
        };
    }
    return {
        id: b.id,
        rideId: b.ride_id,
        passengerId: b.passenger_id,
        seatsBooked: b.seats_booked,
        totalPrice: b.total_price,
        status: b.status,
        bookingDate: b.booking_date,
        paymentMethod: b.payment_method,
        paymentStatus: b.payment_status,
        selectedSeats: b.selected_seats || [],
        ride: hydratedRide
    };
}
exports.default = router;
