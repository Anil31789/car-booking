"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = require("../db.js");
const booking_routes_js_1 = __importDefault(require("../routes/booking.routes.js"));
const ride_routes_js_1 = __importDefault(require("../routes/ride.routes.js"));
const user_routes_js_1 = __importDefault(require("../routes/user.routes.js"));
const JWT_SECRET = 'highwaypool_supersecret_jwt_token_key_2026';
function signToken(userId, email) {
    return jsonwebtoken_1.default.sign({ userId, email }, JWT_SECRET);
}
(0, node_test_1.describe)('Audit Remediation & Direct Payment Flow Tests', () => {
    let app;
    let server;
    const port = 5005;
    const baseUrl = `http://localhost:${port}/api`;
    (0, node_test_1.before)(async () => {
        // Force in-memory fallback
        const { setFallback } = await import('../db.js');
        setFallback(true);
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        app.use('/api/bookings', booking_routes_js_1.default);
        app.use('/api/rides', ride_routes_js_1.default);
        app.use('/api/users', user_routes_js_1.default);
        server = app.listen(port);
    });
    (0, node_test_1.after)(() => {
        if (server)
            server.close();
    });
    (0, node_test_1.test)('1. Prevent Self-Reviews (Driver cannot review themselves)', async () => {
        // Setup mock data
        db_js_1.memoryDb.users = [
            { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123', rating: 5.0, reviews_count: 0 }
        ];
        db_js_1.memoryDb.rides = [
            { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
        ];
        db_js_1.memoryDb.bookings = [
            { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'drv_test', seats_booked: 1, total_price: 100, status: 'completed', payment_method: 'Cash', payment_status: 'Paid' }
        ];
        db_js_1.memoryDb.reviews = [];
        const token = signToken('drv_test', 'driver@test.com');
        const res = await fetch(`${baseUrl}/users/drv_test/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                rating: 5,
                comment: 'Nice ride!',
                bookingId: 'bk_test'
            })
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const body = await res.json();
        node_assert_1.default.strictEqual(body.error, 'You cannot submit a review for yourself');
    });
    (0, node_test_1.test)('2. Validate Rating Boundaries (1 to 5 stars only)', async () => {
        db_js_1.memoryDb.users = [
            { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' },
            { id: 'usr_test', name: 'Test User', email: 'user@test.com', phone: '456' }
        ];
        db_js_1.memoryDb.rides = [
            { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
        ];
        db_js_1.memoryDb.bookings = [
            { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'usr_test', seats_booked: 1, total_price: 100, status: 'completed', payment_method: 'Cash', payment_status: 'Paid' }
        ];
        db_js_1.memoryDb.reviews = [];
        const token = signToken('usr_test', 'user@test.com');
        const res = await fetch(`${baseUrl}/users/drv_test/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                rating: 6,
                comment: 'Too good',
                bookingId: 'bk_test'
            })
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const body = await res.json();
        node_assert_1.default.match(body.error, /Rating must be/);
    });
    (0, node_test_1.test)('3. Verify Booking Completion before Review submission', async () => {
        db_js_1.memoryDb.users = [
            { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' },
            { id: 'usr_test', name: 'Test User', email: 'user@test.com', phone: '456' }
        ];
        db_js_1.memoryDb.rides = [
            { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
        ];
        db_js_1.memoryDb.bookings = [
            { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'usr_test', seats_booked: 1, total_price: 100, status: 'upcoming', payment_method: 'Cash', payment_status: 'Pending' }
        ];
        db_js_1.memoryDb.reviews = [];
        const token = signToken('usr_test', 'user@test.com');
        const res = await fetch(`${baseUrl}/users/drv_test/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                rating: 5,
                comment: 'Great',
                bookingId: 'bk_test'
            })
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const body = await res.json();
        node_assert_1.default.strictEqual(body.error, 'You can only review completed bookings');
    });
    (0, node_test_1.test)('4. Enforce One Review per Booking Limit', async () => {
        db_js_1.memoryDb.users = [
            { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' },
            { id: 'usr_test', name: 'Test User', email: 'user@test.com', phone: '456' }
        ];
        db_js_1.memoryDb.rides = [
            { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
        ];
        db_js_1.memoryDb.bookings = [
            { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'usr_test', seats_booked: 1, total_price: 100, status: 'completed', payment_method: 'Cash', payment_status: 'Paid' }
        ];
        db_js_1.memoryDb.reviews = [
            { id: 'rev_existing', driver_id: 'drv_test', reviewer_id: 'usr_test', rating: 5, comment: 'already reviewed', booking_id: 'bk_test' }
        ];
        const token = signToken('usr_test', 'user@test.com');
        const res = await fetch(`${baseUrl}/users/drv_test/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                rating: 4,
                comment: 'another one',
                bookingId: 'bk_test'
            })
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const body = await res.json();
        node_assert_1.default.strictEqual(body.error, 'You have already submitted a review for this booking');
    });
    (0, node_test_1.test)('5. Prevent Booking Rides that have already Departed', async () => {
        db_js_1.memoryDb.users = [
            { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
        ];
        db_js_1.memoryDb.rides = [
            { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
        ];
        db_js_1.memoryDb.bookings = [];
        const token = signToken('usr_me', 'me@test.com');
        const res = await fetch(`${baseUrl}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                rideId: 'ride_test',
                seatsBooked: 2,
                paymentMethod: 'Cash'
            })
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const body = await res.json();
        node_assert_1.default.strictEqual(body.error, 'Cannot book seats on a ride that has already departed');
    });
    (0, node_test_1.test)('6. Prevent Cancellation of Completed or Departed Rides', async () => {
        db_js_1.memoryDb.users = [
            { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
        ];
        db_js_1.memoryDb.rides = [
            { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
        ];
        db_js_1.memoryDb.bookings = [
            { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'usr_me', seats_booked: 1, total_price: 100, status: 'upcoming', payment_method: 'Cash', payment_status: 'Pending' }
        ];
        const token = signToken('usr_me', 'me@test.com');
        const res = await fetch(`${baseUrl}/bookings/bk_test/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const body = await res.json();
        node_assert_1.default.strictEqual(body.error, 'Cannot cancel a completed or departed ride booking');
    });
    (0, node_test_1.test)('7. Enforce Driver Ownership on Booking Approvals', async () => {
        db_js_1.memoryDb.users = [
            { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' },
            { id: 'drv_other', name: 'Other Driver', email: 'other@test.com', phone: '789' }
        ];
        db_js_1.memoryDb.rides = [
            { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
        ];
        db_js_1.memoryDb.bookings = [
            { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'usr_me', seats_booked: 1, total_price: 100, status: 'pending', payment_method: 'Cash', payment_status: 'Pending' }
        ];
        const token = signToken('drv_other', 'other@test.com');
        const res = await fetch(`${baseUrl}/bookings/bk_test/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        node_assert_1.default.strictEqual(res.status, 403);
        const body = await res.json();
        node_assert_1.default.strictEqual(body.error, 'Unauthorized: Only the ride driver can accept bookings');
    });
    (0, node_test_1.test)('8. Seat Update Boundaries validation', async () => {
        db_js_1.memoryDb.users = [
            { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
        ];
        db_js_1.memoryDb.rides = [
            { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
        ];
        const token = signToken('drv_test', 'driver@test.com');
        const res = await fetch(`${baseUrl}/rides/ride_test/seats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                availableSeats: 5
            })
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const body = await res.json();
        node_assert_1.default.match(body.error, /Available seats must be between/);
    });
    (0, node_test_1.test)('9. Soft Delete Strategy (Ride cancellation)', async () => {
        db_js_1.memoryDb.users = [
            { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
        ];
        db_js_1.memoryDb.rides = [
            { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100, status: 'active' }
        ];
        db_js_1.memoryDb.bookings = [
            { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'usr_me', seats_booked: 1, total_price: 100, status: 'upcoming', payment_method: 'Cash', payment_status: 'Pending' }
        ];
        const token = signToken('drv_test', 'driver@test.com');
        const res = await fetch(`${baseUrl}/rides/ride_test/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const ride = db_js_1.memoryDb.rides.find(r => r.id === 'ride_test');
        node_assert_1.default.strictEqual(ride?.status, 'cancelled');
        const booking = db_js_1.memoryDb.bookings.find(b => b.id === 'bk_test');
        node_assert_1.default.strictEqual(booking?.status, 'cancelled');
        node_assert_1.default.strictEqual(booking?.payment_status, 'Refunded');
    });
    (0, node_test_1.test)('10. Direct Payment mark-paid endpoint', async () => {
        db_js_1.memoryDb.users = [
            { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
        ];
        db_js_1.memoryDb.rides = [
            { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100, status: 'active' }
        ];
        db_js_1.memoryDb.bookings = [
            { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'usr_me', seats_booked: 1, total_price: 100, status: 'upcoming', payment_method: 'Cash', payment_status: 'Pending' }
        ];
        const token = signToken('drv_test', 'driver@test.com');
        const res = await fetch(`${baseUrl}/bookings/bk_test/mark-paid`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const booking = db_js_1.memoryDb.bookings.find(b => b.id === 'bk_test');
        node_assert_1.default.strictEqual(booking?.payment_status, 'Paid');
        node_assert_1.default.strictEqual(booking?.status, 'upcoming');
    });
});
