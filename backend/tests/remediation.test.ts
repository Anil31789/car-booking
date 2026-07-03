import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import jwt from 'jsonwebtoken';
import { memoryDb } from '../db.js';
import bookingRouter from '../routes/booking.routes.js';
import rideRouter from '../routes/ride.routes.js';
import userRouter from '../routes/user.routes.js';

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
    
    app = express();
    app.use(express.json());
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
});
