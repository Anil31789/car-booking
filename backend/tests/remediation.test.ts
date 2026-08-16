import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import jwt from 'jsonwebtoken';
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
    app.use(express.json());

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
        paymentMethod: 'Cash'
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
        seatsBooked: 1
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
        paymentMethod: 'UPI'
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
        paymentMethod: 'UPI'
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
        paymentMethod: 'UPI'
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
});
