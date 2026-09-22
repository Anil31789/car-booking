import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import jwt from 'jsonwebtoken';
import { join } from 'path';
import { memoryDb } from '../db.js';
import bookingRouter from '../routes/booking.routes.js';
import rideRouter from '../routes/ride.routes.js';
import userRouter from '../routes/user.routes.js';
import authRouter from '../routes/auth.routes.js';
import { generalLimiter, sensitiveLimiter, generateGeneralKey, generateSensitiveKey } from '../middleware/rate-limiter.js';

const JWT_SECRET = 'highwaypool_supersecret_jwt_token_key_2026';

function signToken(userId: string, email: string) {
  return jwt.sign({ userId, email }, JWT_SECRET);
}

describe('Audit Remediation & Direct Payment Flow Tests', () => {
  let app: express.Express;
  let server: any;
  const port = 5005;
  const baseUrl = `http://localhost:${port}/api`;

  before(async () => {
    // Force in-memory fallback
    const { setFallback } = await import('../db.js');
    setFallback(true);

    process.env.JWT_SECRET = 'highwaypool_supersecret_jwt_token_key_2026';

    app = express();
    app.set('trust proxy', true);
    app.use(express.json({ limit: '10mb' }));

    const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
    app.use('/uploads', express.static(uploadsDir));
    app.use('/api/uploads', express.static(uploadsDir));

    // Apply general limiter globally
    app.use('/api', generalLimiter);

    app.use('/api/auth', authRouter);
    app.use('/api/bookings', bookingRouter);
    app.use('/api/rides', rideRouter);
    app.use('/api/users', userRouter);

    server = app.listen(port);
  });

  after(() => {
    if (server) server.close();
  });

  test('1. Prevent Self-Reviews (Driver cannot review themselves)', async () => {
    // Setup mock data
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123', rating: 5.0, reviews_count: 0 }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
    ];
    memoryDb.bookings = [
      { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'drv_test', seats_booked: 1, total_price: 100, status: 'completed', payment_method: 'Cash', payment_status: 'Paid' }
    ];
    memoryDb.reviews = [];

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

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'You cannot submit a review for yourself');
  });

  test('2. Validate Rating Boundaries (1 to 5 stars only)', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' },
      { id: 'usr_test', name: 'Test User', email: 'user@test.com', phone: '456' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
    ];
    memoryDb.bookings = [
      { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'usr_test', seats_booked: 1, total_price: 100, status: 'completed', payment_method: 'Cash', payment_status: 'Paid' }
    ];
    memoryDb.reviews = [];

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

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.match(body.error, /Rating must be/);
  });

  test('3. Verify Booking Completion before Review submission', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' },
      { id: 'usr_test', name: 'Test User', email: 'user@test.com', phone: '456' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
    ];
    memoryDb.bookings = [
      { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'usr_test', seats_booked: 1, total_price: 100, status: 'upcoming', payment_method: 'Cash', payment_status: 'Pending' }
    ];
    memoryDb.reviews = [];

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

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'You can only review completed bookings');
  });

  test('4. Enforce One Review per Booking Limit', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' },
      { id: 'usr_test', name: 'Test User', email: 'user@test.com', phone: '456' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
    ];
    memoryDb.bookings = [
      { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'usr_test', seats_booked: 1, total_price: 100, status: 'completed', payment_method: 'Cash', payment_status: 'Paid' }
    ];
    memoryDb.reviews = [
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

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'You have already submitted a review for this booking');
  });

  test('5. Prevent Booking Rides that have already Departed', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
    ];
    memoryDb.bookings = [];

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
        paymentMethod: 'Cash',
        termsAccepted: true,
        termsVersion: 'July 2026'
      })
    });

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'Cannot book seats on a ride that has already departed');
  });

  test('6. Prevent Cancellation of Completed or Departed Rides', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
    ];
    memoryDb.bookings = [
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

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'Cannot cancel a completed or departed ride booking');
  });

  test('7. Enforce Driver Ownership on Booking Approvals', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' },
      { id: 'drv_other', name: 'Other Driver', email: 'other@test.com', phone: '789' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100 }
    ];
    memoryDb.bookings = [
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

    assert.strictEqual(res.status, 403);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'Unauthorized: Only the ride driver can accept bookings');
  });

  test('8. Seat Update Boundaries validation', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
    ];
    memoryDb.rides = [
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

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.match(body.error, /Available seats must be between/);
  });

  test('9. Soft Delete Strategy (Ride cancellation)', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100, status: 'active' }
    ];
    memoryDb.bookings = [
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

    assert.strictEqual(res.status, 200);
    const ride = memoryDb.rides.find(r => r.id === 'ride_test');
    assert.strictEqual(ride?.status, 'cancelled');

    const booking = memoryDb.bookings.find(b => b.id === 'bk_test');
    assert.strictEqual(booking?.status, 'cancelled');
    assert.strictEqual(booking?.payment_status, 'Refunded');
  });

  test('10. Direct Payment mark-paid endpoint', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', total_seats: 4, available_seats: 4, price_per_seat: 100, status: 'active' }
    ];
    memoryDb.bookings = [
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

    assert.strictEqual(res.status, 200);
    const booking = memoryDb.bookings.find(b => b.id === 'bk_test');
    assert.strictEqual(booking?.payment_status, 'Paid');
    assert.strictEqual(booking?.status, 'upcoming');
  });

  test('11. Edit Offered Ride - success', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', arrival_time: '12:00', total_seats: 4, available_seats: 4, price_per_seat: 100, status: 'active', stops: [] }
    ];
    memoryDb.bookings = [];

    const token = signToken('drv_test', 'driver@test.com');
    const res = await fetch(`${baseUrl}/rides/ride_test`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startLocation: 'New A',
        destination: 'New B',
        departureDate: '2030-01-01',
        departureTime: '11:00',
        arrivalTime: '13:00',
        totalSeats: 6,
        pricePerSeat: 150,
        stops: [{ name: 'Mid', arrivalTime: '12:00' }]
      })
    });

    assert.strictEqual(res.status, 200);
    const updated = await res.json();
    assert.strictEqual(updated.startLocation, 'New A');
    assert.strictEqual(updated.pricePerSeat, 150);
    assert.strictEqual(updated.totalSeats, 6);
  });

  test('12. Edit Offered Ride - reject unauthorized driver', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' },
      { id: 'other_drv', name: 'Other Driver', email: 'other@test.com', phone: '456' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', arrival_time: '12:00', total_seats: 4, available_seats: 4, price_per_seat: 100, status: 'active' }
    ];

    const token = signToken('other_drv', 'other@test.com');
    const res = await fetch(`${baseUrl}/rides/ride_test`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startLocation: 'New A',
        destination: 'New B',
        departureDate: '2030-01-01',
        departureTime: '10:00',
        arrivalTime: '12:00',
        totalSeats: 4,
        pricePerSeat: 100
      })
    });

    assert.strictEqual(res.status, 403);
  });

  test('13. Edit Offered Ride - reject past departure', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2020-01-01', departure_time: '10:00', arrival_time: '12:00', total_seats: 4, available_seats: 4, price_per_seat: 100, status: 'active' }
    ];

    const token = signToken('drv_test', 'driver@test.com');
    const res = await fetch(`${baseUrl}/rides/ride_test`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startLocation: 'New A',
        destination: 'New B',
        departureDate: '2020-01-01',
        departureTime: '10:00',
        arrivalTime: '12:00',
        totalSeats: 4,
        pricePerSeat: 100
      })
    });

    assert.strictEqual(res.status, 400);
  });

  test('14. Edit Offered Ride - restrict critical fields with active bookings', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', arrival_time: '12:00', total_seats: 4, available_seats: 3, price_per_seat: 100, status: 'active' }
    ];
    memoryDb.bookings = [
      { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'passenger_test', seats_booked: 1, total_price: 100, status: 'upcoming', payment_method: 'Cash', payment_status: 'Pending' }
    ];

    const token = signToken('drv_test', 'driver@test.com');

    // Try to change start location (should fail)
    let res = await fetch(`${baseUrl}/rides/ride_test`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startLocation: 'New A',
        destination: 'B',
        departureDate: '2030-01-01',
        departureTime: '10:00',
        arrivalTime: '12:00',
        totalSeats: 4,
        pricePerSeat: 100
      })
    });
    assert.strictEqual(res.status, 400);

    // Try to change seats to less than booked (should fail)
    res = await fetch(`${baseUrl}/rides/ride_test`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startLocation: 'A',
        destination: 'B',
        departureDate: '2030-01-01',
        departureTime: '10:00',
        arrivalTime: '12:00',
        totalSeats: 0,
        pricePerSeat: 100
      })
    });
    assert.strictEqual(res.status, 400);

    // Try to change total seats to 3 (should succeed, since booked is 1)
    res = await fetch(`${baseUrl}/rides/ride_test`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startLocation: 'A',
        destination: 'B',
        departureDate: '2030-01-01',
        departureTime: '10:00',
        arrivalTime: '12:00',
        totalSeats: 3,
        pricePerSeat: 100
      })
    });
    assert.strictEqual(res.status, 200);
    const updated = await res.json();
    assert.strictEqual(updated.totalSeats, 3);
    assert.strictEqual(updated.availableSeats, 2);
  });

  test('15. Chronological Time Validation', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '123' }
    ];

    const token = signToken('drv_test', 'driver@test.com');
    // Try to offer ride where arrival time is before departure (should fail)
    const res = await fetch(`${baseUrl}/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startLocation: 'A',
        destination: 'B',
        departureDate: '2030-01-01',
        departureTime: '14:00',
        arrivalTime: '13:00',
        availableSeats: 4,
        totalSeats: 4,
        pricePerSeat: 100
      })
    });
    assert.strictEqual(res.status, 400);
  });

  test('16. Contact Number Requirement', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '' },
      { id: 'passenger_test', name: 'Test Passenger', email: 'passenger@test.com', phone: '' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', arrival_time: '12:00', total_seats: 4, available_seats: 4, price_per_seat: 100, status: 'active' }
    ];

    const drvToken = signToken('drv_test', 'driver@test.com');
    const pToken = signToken('passenger_test', 'passenger@test.com');

    // Try to offer ride without driver phone (should fail)
    let res = await fetch(`${baseUrl}/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${drvToken}`
      },
      body: JSON.stringify({
        startLocation: 'A',
        destination: 'B',
        departureDate: '2030-01-01',
        departureTime: '10:00',
        arrivalTime: '12:00',
        availableSeats: 4,
        totalSeats: 4,
        pricePerSeat: 100
      })
    });
    assert.strictEqual(res.status, 400);

    // Try to book a ride without passenger phone (should fail)
    res = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pToken}`
      },
      body: JSON.stringify({
        rideId: 'ride_test',
        seatsBooked: 1,
        termsAccepted: true,
        termsVersion: 'July 2026'
      })
    });
    assert.strictEqual(res.status, 400);
  });

  test('17. Phone Number Privacy', async () => {
    memoryDb.users = [
      { id: 'drv_test', name: 'Test Driver', email: 'driver@test.com', phone: '9988776655' },
      { id: 'passenger_test', name: 'Test Passenger', email: 'passenger@test.com', phone: '1122334455' },
      { id: 'other_test', name: 'Other User', email: 'other@test.com', phone: '5566778899' }
    ];
    memoryDb.rides = [
      { id: 'ride_test', driver_id: 'drv_test', start_location: 'A', destination: 'B', departure_date: '2030-01-01', departure_time: '10:00', arrival_time: '12:00', total_seats: 4, available_seats: 4, price_per_seat: 100, status: 'active' }
    ];
    // Pending booking
    memoryDb.bookings = [
      { id: 'bk_test', ride_id: 'ride_test', passenger_id: 'passenger_test', seats_booked: 1, total_price: 100, status: 'pending', payment_method: 'Cash', payment_status: 'Pending' }
    ];

    const otherToken = signToken('other_test', 'other@test.com');
    const pToken = signToken('passenger_test', 'passenger@test.com');

    // Public fetch should hide phone number
    let res = await fetch(`${baseUrl}/rides/ride_test`);
    let data = await res.json();
    assert.strictEqual(data.driverPhone, null);

    // Requester with pending booking should still have phone hidden
    res = await fetch(`${baseUrl}/rides/ride_test`, {
      headers: { 'Authorization': `Bearer ${pToken}` }
    });
    data = await res.json();
    assert.strictEqual(data.driverPhone, null);

    // Accept booking
    memoryDb.bookings[0].status = 'upcoming';

    // Now passenger should be able to see driver phone
    res = await fetch(`${baseUrl}/rides/ride_test`, {
      headers: { 'Authorization': `Bearer ${pToken}` }
    });
    data = await res.json();
    assert.strictEqual(data.driverPhone, '9988776655');

    // Unrelated user should still have phone hidden
    res = await fetch(`${baseUrl}/rides/ride_test`, {
      headers: { 'Authorization': `Bearer ${otherToken}` }
    });
    data = await res.json();
    assert.strictEqual(data.driverPhone, null);
  });

  test('18. Rate Limiter: General & Sensitive Limiting', async () => {
    // 1. Check generalLimiter keyGenerator for authenticated users
    const tokenA = signToken('userA', 'a@test.com');
    const tokenB = signToken('userB', 'b@test.com');

    const reqA = { headers: { authorization: `Bearer ${tokenA}` }, ip: '1.2.3.4' };
    const reqB = { headers: { authorization: `Bearer ${tokenB}` }, ip: '1.2.3.4' };
    const reqUnauth = { headers: {}, ip: '1.2.3.4' };

    const keyA = generateGeneralKey(reqA as any);
    const keyB = generateGeneralKey(reqB as any);
    const keyUnauth = generateGeneralKey(reqUnauth as any);

    assert.strictEqual(keyA, 'user_userA');
    assert.strictEqual(keyB, 'user_userB');
    assert.strictEqual(keyUnauth, 'ip_1.2.3.4');

    // 2. Check sensitiveLimiter keyGenerator
    const keySensA = generateSensitiveKey(reqA as any);
    const keySensB = generateSensitiveKey(reqB as any);
    const keySensUnauth = generateSensitiveKey(reqUnauth as any);

    assert.strictEqual(keySensA, 'sensitive_user_userA');
    assert.strictEqual(keySensB, 'sensitive_user_userB');
    assert.strictEqual(keySensUnauth, 'sensitive_ip_1.2.3.4');

    // 3. Test sensitiveLimiter unauthenticated IP rate limiting (limit = 15)
    // Send 15 requests from IP 9.9.9.9 to login route (which has sensitiveLimiter)
    // The 16th request should fail with 429
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '9.9.9.9'
        },
        body: JSON.stringify({ email: 'bad@login.com', password: 'wrongpassword' })
      });
      // Should be 401 Unauthorized or 400 Bad Request, not 429
      assert.notStrictEqual(res.status, 429);
    }

    // 16th request from 9.9.9.9 should return 429
    const blockedRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '9.9.9.9'
      },
      body: JSON.stringify({ email: 'bad@login.com', password: 'wrongpassword' })
    });
    assert.strictEqual(blockedRes.status, 429);
    const blockedData = (await blockedRes.json()) as any;
    assert.ok(blockedData.error.includes('Too many sensitive requests'));

    // 4. Test that a DIFFERENT IP (9.9.9.10) is NOT blocked because of 9.9.9.9's requests
    const greenRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '9.9.9.10'
      },
      body: JSON.stringify({ email: 'bad@login.com', password: 'wrongpassword' })
    });
    assert.notStrictEqual(greenRes.status, 429);
  });

  test('19. Ride and Booking Cancellation Business Rules', async () => {
    // Setup test users & ride in memoryDb
    const dToken = signToken('usr_d', 'driver@test.com');
    const pToken = signToken('usr_p', 'passenger@test.com');

    // Create a mock active ride
    const rId = 'ride_cancel_test';
    memoryDb.rides.push({
      id: rId,
      driver_id: 'usr_d',
      start_location: 'CityA',
      destination: 'CityB',
      departure_date: '2026-12-31',
      departure_time: '18:00',
      arrival_time: '20:00',
      available_seats: 4,
      total_seats: 4,
      price_per_seat: 100,
      status: 'active'
    });

    // Create passenger profile with phone
    memoryDb.users.push({
      id: 'usr_p',
      name: 'Passenger P',
      email: 'passenger@test.com',
      phone: '9988776655'
    });
    memoryDb.users.push({
      id: 'usr_d',
      name: 'Driver D',
      email: 'driver@test.com',
      phone: '1122334455'
    });

    // Passenger books the ride
    let bookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pToken}`
      },
      body: JSON.stringify({
        rideId: rId,
        seatsBooked: 2,
        paymentMethod: 'UPI',
        termsAccepted: true,
        termsVersion: 'July 2026'
      })
    });
    assert.strictEqual(bookRes.status, 200);
    const booking = await bookRes.json();
    assert.strictEqual(booking.status, 'pending');

    // Accept booking to make it 'upcoming'
    memoryDb.bookings.find(b => b.id === booking.id).status = 'upcoming';

    // 1. Driver cancels ride
    const cancelRes = await fetch(`${baseUrl}/rides/${rId}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${dToken}` }
    });
    assert.strictEqual(cancelRes.status, 200);

    // Verify booking is cancelled and cancelled_by = 'driver'
    const updatedBooking = memoryDb.bookings.find(b => b.id === booking.id);
    assert.strictEqual(updatedBooking.status, 'cancelled');
    assert.strictEqual(updatedBooking.cancelled_by, 'driver');

    // Verify passenger received notification
    const passengerNotif = memoryDb.notifications.find(n => n.user_id === 'usr_p');
    assert.ok(passengerNotif);
    assert.strictEqual(passengerNotif.type, 'ride_cancelled');

    // 2. Trying to book a cancelled/inactive ride fails
    const failBookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pToken}`
      },
      body: JSON.stringify({
        rideId: rId,
        seatsBooked: 1,
        paymentMethod: 'UPI',
        termsAccepted: true,
        termsVersion: 'July 2026'
      })
    });
    assert.strictEqual(failBookRes.status, 400);
    const failData = await failBookRes.json();
    assert.ok(failData.error.includes('not active'));

    // 3. Passenger cancels booking
    // Create another ride and booking for passenger cancel test
    const rId2 = 'ride_cancel_test2';
    memoryDb.rides.push({
      id: rId2,
      driver_id: 'usr_d',
      start_location: 'CityA',
      destination: 'CityB',
      departure_date: '2026-12-31',
      departure_time: '18:00',
      arrival_time: '20:00',
      available_seats: 4,
      total_seats: 4,
      price_per_seat: 100,
      status: 'active'
    });

    const bookRes2 = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pToken}`
      },
      body: JSON.stringify({
        rideId: rId2,
        seatsBooked: 2,
        paymentMethod: 'UPI',
        termsAccepted: true,
        termsVersion: 'July 2026'
      })
    });
    const booking2 = await bookRes2.json();

    // Set booking2 status to upcoming
    memoryDb.bookings.find(b => b.id === booking2.id).status = 'upcoming';

    // Verify user other than owner cannot cancel booking
    const unauthorizedToken = signToken('usr_unauthorized', 'unauth@test.com');
    const unauthorizedCancelRes = await fetch(`${baseUrl}/bookings/${booking2.id}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${unauthorizedToken}` }
    });
    assert.strictEqual(unauthorizedCancelRes.status, 403);

    // Cancel booking2 as passenger
    const cancelBkRes = await fetch(`${baseUrl}/bookings/${booking2.id}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${pToken}` }
    });
    assert.strictEqual(cancelBkRes.status, 200);

    const updatedBooking2 = memoryDb.bookings.find(b => b.id === booking2.id);
    assert.strictEqual(updatedBooking2.status, 'cancelled');
    assert.strictEqual(updatedBooking2.cancelled_by, 'passenger');

    // Verify driver received notification
    const driverNotif = memoryDb.notifications.find(n => n.user_id === 'usr_d' && n.type === 'booking_cancelled');
    assert.ok(driverNotif);
  });

  test('20. Driver Completed Trips Count Statistics', async () => {
    // Setup mock driver, passengers, and rides in memoryDb
    const dId = 'usr_driver_t20';
    const pId1 = 'usr_pass1_t20';
    const pId2 = 'usr_pass2_t20';

    const dToken = signToken(dId, 'driver_t20@test.com');
    const pToken1 = signToken(pId1, 'pass1_t20@test.com');
    const pToken2 = signToken(pId2, 'pass2_t20@test.com');

    // Create users in memory
    memoryDb.users.push({
      id: dId,
      name: 'Driver T20',
      email: 'driver_t20@test.com',
      phone: '1111111111'
    });
    memoryDb.users.push({
      id: pId1,
      name: 'Passenger 1',
      email: 'pass1_t20@test.com',
      phone: '2222222222'
    });
    memoryDb.users.push({
      id: pId2,
      name: 'Passenger 2',
      email: 'pass2_t20@test.com',
      phone: '3333333333'
    });

    // 1. Driver with no completed rides -> 0 trips
    const getStats = async (token: string) => {
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      return data.tripsCount;
    };

    let tripsCount = await getStats(dToken);
    assert.strictEqual(tripsCount, 0);

    // Create a ride
    const rId1 = 'ride_t20_1';
    memoryDb.rides.push({
      id: rId1,
      driver_id: dId,
      start_location: 'CityA',
      destination: 'CityB',
      departure_date: '2026-12-31',
      departure_time: '18:00',
      arrival_time: '20:00',
      available_seats: 4,
      total_seats: 4,
      price_per_seat: 100,
      status: 'active'
    });

    // 6. Upcoming ride -> not counted
    tripsCount = await getStats(dToken);
    assert.strictEqual(tripsCount, 0);

    // Create a pending booking
    const bId1 = 'booking_t20_1';
    memoryDb.bookings.push({
      id: bId1,
      ride_id: rId1,
      passenger_id: pId1,
      seats_booked: 1,
      total_price: 100,
      status: 'pending',
      booking_date: '2026-08-15',
      payment_method: 'UPI',
      payment_status: 'Pending'
    });

    // 7. Pending booking -> not counted
    tripsCount = await getStats(dToken);
    assert.strictEqual(tripsCount, 0);

    // 2. Driver with one completed ride -> 1 trip
    // Mark booking as completed
    memoryDb.bookings.find(b => b.id === bId1).status = 'completed';
    tripsCount = await getStats(dToken);
    assert.strictEqual(tripsCount, 1);

    // 4. One completed ride with multiple passengers -> still 1 trip
    const bId2 = 'booking_t20_2';
    memoryDb.bookings.push({
      id: bId2,
      ride_id: rId1,
      passenger_id: pId2,
      seats_booked: 1,
      total_price: 100,
      status: 'completed',
      booking_date: '2026-08-15',
      payment_method: 'UPI',
      payment_status: 'Paid'
    });
    tripsCount = await getStats(dToken);
    assert.strictEqual(tripsCount, 1);

    // 3. Driver with two completed rides -> 2 trips
    const rId2 = 'ride_t20_2';
    memoryDb.rides.push({
      id: rId2,
      driver_id: dId,
      start_location: 'CityA',
      destination: 'CityC',
      departure_date: '2026-12-31',
      departure_time: '18:00',
      arrival_time: '20:00',
      available_seats: 4,
      total_seats: 4,
      price_per_seat: 100,
      status: 'active'
    });
    const bId3 = 'booking_t20_3';
    memoryDb.bookings.push({
      id: bId3,
      ride_id: rId2,
      passenger_id: pId1,
      seats_booked: 1,
      total_price: 100,
      status: 'completed',
      booking_date: '2026-08-15',
      payment_method: 'UPI',
      payment_status: 'Paid'
    });
    tripsCount = await getStats(dToken);
    assert.strictEqual(tripsCount, 2);

    // 5. Cancelled ride -> not counted
    memoryDb.rides.find(r => r.id === rId2).status = 'cancelled';
    tripsCount = await getStats(dToken);
    assert.strictEqual(tripsCount, 1); // Goes back to 1 since rId2 is cancelled
    memoryDb.rides.find(r => r.id === rId2).status = 'active'; // Restore

    // 8. Completed ride belonging to another driver -> not counted
    const dIdOther = 'usr_driver_other_t20';
    memoryDb.rides.push({
      id: 'ride_other_t20',
      driver_id: dIdOther,
      start_location: 'CityA',
      destination: 'CityD',
      departure_date: '2026-12-31',
      departure_time: '18:00',
      arrival_time: '20:00',
      available_seats: 4,
      total_seats: 4,
      price_per_seat: 100,
      status: 'active'
    });
    memoryDb.bookings.push({
      id: 'booking_other_t20',
      ride_id: 'ride_other_t20',
      passenger_id: pId1,
      seats_booked: 1,
      total_price: 100,
      status: 'completed',
      booking_date: '2026-08-15',
      payment_method: 'UPI',
      payment_status: 'Paid'
    });
    tripsCount = await getStats(dToken);
    assert.strictEqual(tripsCount, 2);

    // 9. Completed passenger booking where the user is NOT the driver -> not counted
    const p1Trips = await getStats(pToken1);
    assert.strictEqual(p1Trips, 3);
  });

  test('21. Reviews Integration & Duplicate Validation', async () => {
    // Setup driver, passenger, ride, booking
    const dId = 'usr_driver_t21';
    const pId = 'usr_passenger_t21';
    const otherPId = 'usr_other_p_t21';

    const dToken = signToken(dId, 'driver_t21@test.com');
    const pToken = signToken(pId, 'passenger_t21@test.com');

    // Create users in memoryDb
    memoryDb.users.push({
      id: dId,
      name: 'Driver T21',
      email: 'driver_t21@test.com',
      phone: '1111111111',
      license_number: 'LIC123456',
      is_license_verified: true
    });
    memoryDb.users.push({
      id: pId,
      name: 'Passenger T21',
      email: 'passenger_t21@test.com',
      phone: '2222222222'
    });
    memoryDb.users.push({
      id: otherPId,
      name: 'Other Passenger T21',
      email: 'other_p_t21@test.com',
      phone: '3333333333'
    });

    // Create ride
    const rId = 'ride_t21';
    memoryDb.rides.push({
      id: rId,
      driver_id: dId,
      start_location: 'CityA',
      destination: 'CityB',
      departure_date: '2026-12-31',
      departure_time: '18:00',
      arrival_time: '20:00',
      available_seats: 4,
      total_seats: 4,
      price_per_seat: 100,
      status: 'active'
    });

    // Create completed booking
    const bId = 'booking_t21';
    memoryDb.bookings.push({
      id: bId,
      ride_id: rId,
      passenger_id: pId,
      seats_booked: 1,
      total_price: 100,
      status: 'completed',
      booking_date: '2026-08-16',
      payment_method: 'UPI',
      payment_status: 'Paid'
    });

    // Create another booking for other user
    const otherBId = 'booking_t21_other';
    memoryDb.bookings.push({
      id: otherBId,
      ride_id: rId,
      passenger_id: otherPId,
      seats_booked: 1,
      total_price: 100,
      status: 'completed',
      booking_date: '2026-08-16',
      payment_method: 'UPI',
      payment_status: 'Paid'
    });

    // 1. First review submission succeeds
    const submitRes = await fetch(`${baseUrl}/users/${dId}/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rating: 5,
        comment: 'Great ride!',
        reviewerName: 'Passenger T21',
        reviewerPhoto: 'photo_url',
        bookingId: bId
      })
    });
    assert.strictEqual(submitRes.status, 200);
    const submittedReview = await submitRes.json();
    assert.strictEqual(submittedReview.comment, 'Great ride!');

    // 2. Review is persisted. Fetch reviews immediately.
    const getRes = await fetch(`${baseUrl}/users/${dId}/reviews`);
    assert.strictEqual(getRes.status, 200);
    const reviewsList = await getRes.json();
    assert.ok(reviewsList.some((r: any) => r.id === submittedReview.id));

    // 4. Second review submission for the same booking returns the expected duplicate-review error
    const duplicateRes = await fetch(`${baseUrl}/users/${dId}/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rating: 4,
        comment: 'Second review try',
        reviewerName: 'Passenger T21',
        reviewerPhoto: 'photo_url',
        bookingId: bId
      })
    });
    assert.strictEqual(duplicateRes.status, 400);
    const dupError = await duplicateRes.json();
    assert.ok(dupError.error.includes('already submitted'));

    // 5. Existing review remains visible after the duplicate submission attempt
    const getRes2 = await fetch(`${baseUrl}/users/${dId}/reviews`);
    assert.strictEqual(getRes2.status, 200);
    const reviewsList2 = await getRes2.json();
    assert.ok(reviewsList2.some((r: any) => r.id === submittedReview.id));

    // 6. Reviews from another booking are not mixed into the current booking
    const otherReviewCheck = memoryDb.reviews.find(r => r.booking_id === otherBId);
    assert.strictEqual(otherReviewCheck, undefined);
  });

  test('22. Profile Photo Upload, Validation, Removal & Privacy Rules', async () => {
    const uId = 'usr_photo_t22';
    const uEmail = 'photo_t22@test.com';
    const uToken = signToken(uId, uEmail);

    memoryDb.users.push({
      id: uId,
      name: 'Photo Test User',
      email: uEmail,
      phone: '9998887776',
      photo_url: null
    });

    // 1. Unauthorized upload attempt (no token) -> 401
    const unauthRes = await fetch(`${baseUrl}/users/me/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' })
    });
    assert.strictEqual(unauthRes.status, 401);

    // 2. Invalid image format -> 400
    const invalidFmtRes = await fetch(`${baseUrl}/users/me/photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${uToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ photo: 'data:text/plain;base64,SGVsbG8=' })
    });
    assert.strictEqual(invalidFmtRes.status, 400);

    // 3. Oversized image (> 5MB) -> 400
    const oversizedBase64 = 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024);
    const oversizedRes = await fetch(`${baseUrl}/users/me/photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${uToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ photo: oversizedBase64 })
    });
    assert.strictEqual(oversizedRes.status, 400);

    // 4. Valid image upload -> 200 OK
    const samplePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const validRes = await fetch(`${baseUrl}/users/me/photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${uToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ photo: samplePng })
    });
    assert.strictEqual(validRes.status, 200);
    const validJson = await validRes.json();
    assert.strictEqual(validJson.success, true);
    assert.ok(validJson.photoUrl.startsWith('/api/uploads/profile-photos/'));

    // 4b. Verify static serving via GET /api/uploads/... -> 200 OK
    const staticRes = await fetch(`http://localhost:${port}${validJson.photoUrl}`);
    assert.strictEqual(staticRes.status, 200);

    // 4c. Verify dual static serving via GET /uploads/... -> 200 OK
    const dualStaticRes = await fetch(`http://localhost:${port}${validJson.photoUrl.replace('/api', '')}`);
    assert.strictEqual(dualStaticRes.status, 200);

    // 5. GET /api/auth/me returns updated photoUrl
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${uToken}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meJson = await meRes.json();
    assert.strictEqual(meJson.photoUrl, validJson.photoUrl);

    // 6. Photo removal -> 200 OK
    const removeRes = await fetch(`${baseUrl}/users/me/photo`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${uToken}` }
    });
    assert.strictEqual(removeRes.status, 200);
    const removeJson = await removeRes.json();
    assert.strictEqual(removeJson.photoUrl, null);

    // Verify static file is removed from disk -> 404
    const staticResAfterDelete = await fetch(`http://localhost:${port}${validJson.photoUrl}`);
    assert.strictEqual(staticResAfterDelete.status, 404);

    // GET /api/auth/me verifies photoUrl is cleared
    const meRes2 = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${uToken}` }
    });
    assert.strictEqual(meRes2.status, 200);
    const meJson2 = await meRes2.json();
    assert.strictEqual(meJson2.photoUrl, null);
  });

  test('23. WhatsApp & Call contact options with booking privacy rules', async () => {
    // Setup driver, passenger, stranger, ride, and pending booking
    memoryDb.users = [
      { id: 'u_drv_wa', name: 'Raj Driver', email: 'driver_wa@test.com', phone: '9876543210', rating: 4.8, reviews_count: 5 },
      { id: 'u_pass_wa', name: 'Priya Passenger', email: 'passenger_wa@test.com', phone: '+91 91234-56789', rating: 5.0, reviews_count: 2 },
      { id: 'u_stranger_wa', name: 'Stranger User', email: 'stranger_wa@test.com', phone: '9998887776', rating: 5.0, reviews_count: 0 }
    ];
    memoryDb.vehicles = [
      { id: 'v_wa', user_id: 'u_drv_wa', model: 'Honda City', number_plate: 'MH 12 AB 1234', type: 'Sedan', color: 'White' }
    ];
    memoryDb.rides = [
      {
        id: 'r_wa_1',
        driver_id: 'u_drv_wa',
        vehicle_id: 'v_wa',
        start_location: 'Mumbai',
        destination: 'Pune',
        departure_date: '2026-10-10',
        departure_time: '09:00',
        total_seats: 4,
        available_seats: 3,
        price_per_seat: 400
      }
    ];
    memoryDb.bookings = [
      {
        id: 'b_wa_pending',
        ride_id: 'r_wa_1',
        passenger_id: 'u_pass_wa',
        seats_booked: 1,
        total_price: 400,
        status: 'pending',
        booking_date: '2026-09-17',
        payment_method: 'UPI',
        payment_status: 'Pending'
      }
    ];

    const drvToken = signToken('u_drv_wa', 'driver_wa@test.com');
    const passToken = signToken('u_pass_wa', 'passenger_wa@test.com');
    const strangerToken = signToken('u_stranger_wa', 'stranger_wa@test.com');

    // 1. Unauthenticated or public query for ride details should NOT expose driver phone
    const publicRideRes = await fetch(`${baseUrl}/rides/r_wa_1`);
    assert.strictEqual(publicRideRes.status, 200);
    const publicRideJson = await publicRideRes.json();
    assert.strictEqual(publicRideJson.driverPhone, null);

    // 2. Stranger authenticated query for ride details should NOT expose driver phone
    const strangerRideRes = await fetch(`${baseUrl}/rides/r_wa_1`, {
      headers: { 'Authorization': `Bearer ${strangerToken}` }
    });
    assert.strictEqual(strangerRideRes.status, 200);
    const strangerRideJson = await strangerRideRes.json();
    assert.strictEqual(strangerRideJson.driverPhone, null);

    // 3. Passenger with PENDING booking should NOT see driver phone in My Bookings or Ride Details
    const pendingBkRes = await fetch(`${baseUrl}/bookings/user/u_pass_wa`, {
      headers: { 'Authorization': `Bearer ${passToken}` }
    });
    assert.strictEqual(pendingBkRes.status, 200);
    const pendingBkJson = await pendingBkRes.json();
    const myPendingBk = pendingBkJson.find((b: any) => b.id === 'b_wa_pending');
    assert.ok(myPendingBk);
    assert.strictEqual(myPendingBk.ride.driverPhone, null);

    // 4. Driver with PENDING request should NOT see passenger phone in Driver Requests
    const drvReqRes = await fetch(`${baseUrl}/bookings/driver`, {
      headers: { 'Authorization': `Bearer ${drvToken}` }
    });
    assert.strictEqual(drvReqRes.status, 200);
    const drvReqJson = await drvReqRes.json();
    const drvPendingReq = drvReqJson.find((r: any) => r.id === 'b_wa_pending');
    assert.ok(drvPendingReq);
    assert.strictEqual(drvPendingReq.passengerPhone, null);

    // 5. Driver accepts booking -> status becomes 'upcoming'
    const acceptRes = await fetch(`${baseUrl}/bookings/b_wa_pending/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${drvToken}` }
    });
    assert.strictEqual(acceptRes.status, 200);

    // 6. Passenger now sees driverPhone in My Bookings & Ride Details
    const acceptedBkRes = await fetch(`${baseUrl}/bookings/user/u_pass_wa`, {
      headers: { 'Authorization': `Bearer ${passToken}` }
    });
    assert.strictEqual(acceptedBkRes.status, 200);
    const acceptedBkJson = await acceptedBkRes.json();
    const myAcceptedBk = acceptedBkJson.find((b: any) => b.id === 'b_wa_pending');
    assert.ok(myAcceptedBk);
    assert.strictEqual(myAcceptedBk.ride.driverPhone, '9876543210');

    const passRideRes = await fetch(`${baseUrl}/rides/r_wa_1`, {
      headers: { 'Authorization': `Bearer ${passToken}` }
    });
    assert.strictEqual(passRideRes.status, 200);
    const passRideJson = await passRideRes.json();
    assert.strictEqual(passRideJson.driverPhone, '9876543210');

    // 7. Driver now sees passengerPhone in Driver Requests
    const drvAcceptedReqRes = await fetch(`${baseUrl}/bookings/driver`, {
      headers: { 'Authorization': `Bearer ${drvToken}` }
    });
    assert.strictEqual(drvAcceptedReqRes.status, 200);
    const drvAcceptedReqJson = await drvAcceptedReqRes.json();
    const drvAcceptedReq = drvAcceptedReqJson.find((r: any) => r.id === 'b_wa_pending');
    assert.ok(drvAcceptedReq);
    assert.strictEqual(drvAcceptedReq.passengerPhone, '+91 91234-56789');

    // 8. Test WhatsApp deep link construction and phone normalization logic
    const normalizePhoneForWhatsApp = (phone: string | null | undefined): string | null => {
      if (!phone || typeof phone !== 'string') return null;
      const digits = phone.replace(/\D/g, '');
      if (!digits) return null;
      if (digits.length === 10) return '91' + digits;
      if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.substring(1);
      if (digits.length === 12 && digits.startsWith('91')) return digits;
      if (digits.length >= 10 && digits.length <= 15) return digits;
      return null;
    };

    const getWhatsAppUrl = (phone: string | null | undefined, originOrRoute?: string, destination?: string) => {
      const normalized = normalizePhoneForWhatsApp(phone);
      if (!normalized) return null;
      let routeDesc = '';
      if (originOrRoute && destination) {
        routeDesc = `${originOrRoute.trim()} to ${destination.trim()}`;
      } else if (originOrRoute) {
        routeDesc = originOrRoute.trim();
      } else {
        routeDesc = 'our scheduled ride';
      }
      const message = `Hi, I have a HighwayPool booking with you for ${routeDesc}.`;
      return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
    };

    // Passenger contacting Driver via WhatsApp
    const passengerToDriverWa = getWhatsAppUrl(
      myAcceptedBk.ride.driverPhone,
      myAcceptedBk.ride.startLocation,
      myAcceptedBk.ride.destination
    );
    assert.strictEqual(
      passengerToDriverWa,
      'https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20HighwayPool%20booking%20with%20you%20for%20Mumbai%20to%20Pune.'
    );

    // Driver contacting Passenger via WhatsApp
    const driverToPassengerWa = getWhatsAppUrl(
      drvAcceptedReq.passengerPhone,
      drvAcceptedReq.rideRoute
    );
    assert.strictEqual(
      driverToPassengerWa,
      'https://wa.me/919123456789?text=Hi%2C%20I%20have%20a%20HighwayPool%20booking%20with%20you%20for%20Mumbai%20to%20Pune.'
    );

    // Missing or invalid phone returns null gracefully
    assert.strictEqual(getWhatsAppUrl(null, 'A', 'B'), null);
    assert.strictEqual(getWhatsAppUrl('invalid_phone', 'A', 'B'), null);
  });

  test('25. Regression Test: Vehicle ID resolution and Foreign Key integrity in Create and Edit Ride', async () => {
    // Setup existing vehicle in database with ID veh_me_1 and plate MH-12-HC-1029
    memoryDb.users = [
      { id: 'usr_me', name: 'Rohan Deshmukh', email: 'rohan@test.com', phone: '+919988776655', rating: 5.0, reviews_count: 0 }
    ];
    memoryDb.vehicles = [
      {
        id: 'veh_me_1',
        user_id: 'usr_me',
        model: 'Honda City 2020',
        number_plate: 'MH-12-HC-1029',
        type: 'Sedan',
        color: 'Silver'
      }
    ];
    memoryDb.rides = [];
    memoryDb.bookings = [];

    const token = signToken('usr_me', 'rohan@test.com');

    // Scenario A: Client submits custom vehicle with new speculative ID 'veh_1789625063902'
    // but the number plate 'MH-12-HC-1029' already exists in the vehicles table
    const postRes = await fetch(`${baseUrl}/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startLocation: 'Mumbai',
        destination: 'Pune',
        departureDate: '2026-10-01',
        departureTime: '08:00',
        arrivalTime: '11:00',
        totalSeats: 4,
        availableSeats: 4,
        pricePerSeat: 350,
        vehicle: {
          id: 'veh_1789625063902', // Stale/divergent client ID
          model: 'Honda City 2024 Facelift',
          numberPlate: 'MH-12-HC-1029', // Existing plate
          type: 'Sedan',
          color: 'Golden Brown'
        },
        aboutRide: 'Safe and comfortable drive.'
      })
    });

    assert.strictEqual(postRes.status, 200, 'POST /rides must succeed with status 200');
    const createdRide: any = await postRes.json();
    
    // Crucial check: the ride's vehicle.id must be the real persistent DB id ('veh_me_1'),
    // never the conflicting/stale client ID ('veh_1789625063902')
    assert.strictEqual(createdRide.vehicle.id, 'veh_me_1', 'Ride vehicle_id must resolve to existing vehicle id');
    assert.strictEqual(createdRide.vehicle.model, 'Honda City 2024 Facelift', 'Vehicle model should be updated');
    assert.strictEqual(createdRide.vehicle.color, 'Golden Brown', 'Vehicle color should be updated');

    // Ensure no duplicate or orphan vehicles were added in memory
    const matchingVehicles = memoryDb.vehicles.filter(v => v.number_plate === 'MH-12-HC-1029');
    assert.strictEqual(matchingVehicles.length, 1, 'Only one record must exist per unique number plate');
    assert.strictEqual(matchingVehicles[0].id, 'veh_me_1');

    // Scenario B: Edit ride with same plate and ensure vehicle resolution works cleanly
    const putRes = await fetch(`${baseUrl}/rides/${createdRide.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startLocation: 'Mumbai',
        destination: 'Pune',
        departureDate: '2026-10-01',
        departureTime: '08:00',
        arrivalTime: '11:00',
        totalSeats: 4,
        availableSeats: 4,
        pricePerSeat: 400,
        vehicle: {
          id: 'veh_custom_new_9999', // Another speculative client ID
          model: 'Honda City 2024 Executive',
          numberPlate: 'MH-12-HC-1029',
          type: 'Sedan',
          color: 'Pearl White'
        },
        aboutRide: 'Updated ride info.'
      })
    });

    assert.strictEqual(putRes.status, 200, 'PUT /rides/:id must succeed with status 200');
    const updatedRide: any = await putRes.json();
    assert.strictEqual(updatedRide.vehicle.id, 'veh_me_1', 'Edited ride must retain existing vehicle id');
    assert.strictEqual(updatedRide.vehicle.color, 'Pearl White', 'Vehicle color must be updated on conflict');

    // Scenario C: Create ride with brand new unique vehicle
    const postNewVehRes = await fetch(`${baseUrl}/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startLocation: 'Pune',
        destination: 'Nagpur',
        departureDate: '2026-10-02',
        departureTime: '06:00',
        arrivalTime: '19:00',
        totalSeats: 6,
        availableSeats: 6,
        pricePerSeat: 1100,
        vehicle: {
          id: 'veh_new_brand_123',
          model: 'Tata Safari',
          numberPlate: 'MH-14-TS-7777',
          type: 'SUV',
          color: 'Black'
        },
        aboutRide: 'Long distance trip.'
      })
    });

    assert.strictEqual(postNewVehRes.status, 200, 'POST /rides with new vehicle must succeed');
    const newRideData: any = await postNewVehRes.json();
    assert.strictEqual(newRideData.vehicle.id, 'veh_new_brand_123');
    assert.strictEqual(newRideData.vehicle.numberPlate, 'MH-14-TS-7777');
  });

  test('26. Terms & Conditions Acceptance Validation in Booking Flow', async () => {
    // Setup driver, passenger, and active ride
    memoryDb.users = [
      { id: 'usr_tc_drv', name: 'Driver Rohan', email: 'driver_tc@test.com', phone: '+919876543210', rating: 5.0, reviews_count: 0 },
      { id: 'usr_tc_pass', name: 'Passenger Priya', email: 'passenger_tc@test.com', phone: '+919123456780', rating: 5.0, reviews_count: 0 }
    ];
    memoryDb.vehicles = [
      { id: 'veh_tc_1', user_id: 'usr_tc_drv', model: 'Hyundai Creta', number_plate: 'MH-14-HC-2026', type: 'SUV', color: 'White' }
    ];
    memoryDb.rides = [
      {
        id: 'ride_tc_1',
        driver_id: 'usr_tc_drv',
        start_location: 'Mumbai',
        destination: 'Pune',
        stops: [],
        departure_date: '2026-10-15',
        departure_time: '09:00',
        arrival_time: '12:00',
        available_seats: 4,
        total_seats: 4,
        price_per_seat: 350,
        vehicle_id: 'veh_tc_1',
        status: 'active'
      }
    ];
    memoryDb.bookings = [];

    const passToken = signToken('usr_tc_pass', 'passenger_tc@test.com');

    // 1. Booking WITHOUT T&C acceptance (omitted) MUST BE REJECTED
    const rejectNoTcRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passToken}`
      },
      body: JSON.stringify({
        rideId: 'ride_tc_1',
        seatsBooked: 1,
        paymentMethod: 'Cash'
      })
    });
    assert.strictEqual(rejectNoTcRes.status, 400, 'Direct API booking without termsAccepted must return 400');
    const rejectNoTcBody: any = await rejectNoTcRes.json();
    assert.ok(
      rejectNoTcBody.error.includes('Terms & Conditions'),
      'Rejection error must mention Terms & Conditions'
    );
    assert.strictEqual(memoryDb.bookings.length, 0, 'No booking should be created when T&C is not accepted');

    // 2. Booking with termsAccepted explicitly false MUST BE REJECTED
    const rejectFalseTcRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passToken}`
      },
      body: JSON.stringify({
        rideId: 'ride_tc_1',
        seatsBooked: 1,
        paymentMethod: 'Cash',
        termsAccepted: false
      })
    });
    assert.strictEqual(rejectFalseTcRes.status, 400, 'Booking with termsAccepted: false must return 400');
    assert.strictEqual(memoryDb.bookings.length, 0, 'No booking should be created when termsAccepted is false');

    // 3. Booking WITH T&C ACCEPTED MUST SUCCEED
    const successRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passToken}`
      },
      body: JSON.stringify({
        rideId: 'ride_tc_1',
        seatsBooked: 2,
        paymentMethod: 'UPI',
        selectedSeats: [1, 2],
        termsAccepted: true,
        termsVersion: 'July 2026'
      })
    });
    assert.strictEqual(successRes.status, 200, 'Booking with termsAccepted: true must return 200');
    const createdBooking: any = await successRes.json();

    // 4. Acceptance timestamp and version are stored correctly
    assert.strictEqual(createdBooking.termsAccepted, true, 'termsAccepted must be true in returned booking');
    assert.strictEqual(createdBooking.termsVersion, 'July 2026', 'termsVersion must match July 2026');
    assert.ok(createdBooking.termsAcceptedAt, 'termsAcceptedAt timestamp must be present');
    assert.ok(
      !isNaN(Date.parse(createdBooking.termsAcceptedAt)),
      'termsAcceptedAt must be a valid ISO date timestamp'
    );

    // Verify underlying stored booking record in database
    const storedBooking = memoryDb.bookings.find(b => b.id === createdBooking.id);
    assert.ok(storedBooking, 'Booking record must exist in DB');
    assert.strictEqual(storedBooking.terms_accepted, true);
    assert.strictEqual(storedBooking.terms_version, 'July 2026');
    assert.strictEqual(storedBooking.terms_accepted_at, createdBooking.termsAcceptedAt);

    // 5. Existing booking functionality continues to work
    const getUserBookingsRes = await fetch(`${baseUrl}/bookings/user/usr_tc_pass`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${passToken}`
      }
    });
    assert.strictEqual(getUserBookingsRes.status, 200);
    const userBookings: any[] = await getUserBookingsRes.json();
    assert.strictEqual(userBookings.length, 1);
    const fetchedBooking = userBookings[0];
    assert.strictEqual(fetchedBooking.id, createdBooking.id);
    assert.strictEqual(fetchedBooking.seatsBooked, 2);
    assert.strictEqual(fetchedBooking.totalPrice, 700);
    assert.strictEqual(fetchedBooking.paymentMethod, 'UPI');
    assert.strictEqual(fetchedBooking.status, 'pending');
    assert.strictEqual(fetchedBooking.termsAccepted, true);
    assert.strictEqual(fetchedBooking.termsVersion, 'July 2026');
    assert.strictEqual(fetchedBooking.termsAcceptedAt, createdBooking.termsAcceptedAt);
    assert.ok(fetchedBooking.ride, 'Ride details must remain properly hydrated');
    assert.strictEqual(fetchedBooking.ride.startLocation, 'Mumbai');
    assert.strictEqual(fetchedBooking.ride.destination, 'Pune');
  });
});
