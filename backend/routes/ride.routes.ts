import { Router, Request, Response } from 'express';
import { dbQuery, isFallback, memoryDb, pool } from '../db.js';
import { authenticateToken } from './auth.routes.js';

const router = Router();

// 1. GET /api/rides
router.get('/', async (req: Request, res: Response) => {
  try {
    let ridesList: any[] = [];
    
    if (isFallback) {
      ridesList = memoryDb.rides.filter(r => r.status === 'active' || !r.status).map(r => hydrateRideInMemory(r));
    } else {
      const q = `
        SELECT r.*, 
               u.name AS driver_name, u.photo_url AS driver_photo, u.rating AS driver_rating, 
               TO_CHAR(u.created_at, 'Mon YYYY') AS driver_joined, 
               (SELECT COUNT(*) FROM rides r2 WHERE r2.driver_id = u.id AND r2.status = 'completed') AS driver_trips, 
               u.phone AS driver_phone, 
               u.is_license_verified AS is_driver_verified,
               v.model AS vehicle_model, v.number_plate AS vehicle_plate, v.type AS vehicle_type, v.color AS vehicle_color
        FROM rides r
        JOIN users u ON r.driver_id = u.id
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        WHERE r.status = 'active'
      `;
      const result = await dbQuery(q);
      ridesList = result.rows.map((r: any) => formatRideRow(r));
    }
    
    return res.json(ridesList);
  } catch (err: any) {
    console.error('Fetch Rides Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 2. GET /api/rides/:id
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    let ride: any = null;
    
    if (isFallback) {
      const found = memoryDb.rides.find(r => r.id === id);
      if (found && (found.status === 'active' || !found.status)) {
        ride = hydrateRideInMemory(found);
        const rideBookings = memoryDb.bookings.filter(b => b.ride_id === id && b.status !== 'cancelled');
        const occupiedSeats: number[] = [];
        rideBookings.forEach(b => {
          if (b.selected_seats) {
            occupiedSeats.push(...b.selected_seats);
          }
        });
        ride.occupiedSeats = occupiedSeats;
      }
    } else {
      const q = `
        SELECT r.*, 
               u.name AS driver_name, u.photo_url AS driver_photo, u.rating AS driver_rating, 
               TO_CHAR(u.created_at, 'Mon YYYY') AS driver_joined, 
               (SELECT COUNT(*) FROM rides r2 WHERE r2.driver_id = u.id AND r2.status = 'completed') AS driver_trips, 
               u.phone AS driver_phone, 
               u.is_license_verified AS is_driver_verified,
               v.model AS vehicle_model, v.number_plate AS vehicle_plate, v.type AS vehicle_type, v.color AS vehicle_color
        FROM rides r
        JOIN users u ON r.driver_id = u.id
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        WHERE r.id = $1 AND r.status = 'active'
      `;
      const result = await dbQuery(q, [id]);
      if (result.rows.length > 0) {
        ride = formatRideRow(result.rows[0]);
        const occupiedRes = await dbQuery(
          `SELECT COALESCE(array_agg(seat), '{}'::int[]) AS occupied_seats 
           FROM (
             SELECT unnest(selected_seats) AS seat 
             FROM bookings 
             WHERE ride_id = $1 AND status != 'cancelled'
           ) sub`,
          [id]
        );
        ride.occupiedSeats = occupiedRes.rows[0].occupied_seats || [];
      }
    }
    
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    return res.json(ride);
  } catch (err: any) {
    console.error('Fetch Ride By ID Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 3. POST /api/rides/search
router.post('/search', async (req: Request, res: Response) => {
  const { query, filters = {} } = req.body;
  if (!query) return res.status(400).json({ error: 'Search query is required' });

  const fromLoc = query.from ? query.from.toLowerCase().trim() : '';
  const toLoc = query.to ? query.to.toLowerCase().trim() : '';
  const depDate = query.date || '';
  const passengerCount = Number(query.passengers) || 1;

  try {
    let results: any[] = [];
    
    if (isFallback) {
      let temp = memoryDb.rides.filter(r => r.status === 'active' || !r.status).map(r => hydrateRideInMemory(r));
      
      if (fromLoc) temp = temp.filter(r => r.startLocation.toLowerCase().includes(fromLoc));
      if (toLoc) temp = temp.filter(r => r.destination.toLowerCase().includes(toLoc));
      if (depDate) temp = temp.filter(r => r.departureDate === depDate);
      
      // Filters
      if (filters.maxPrice !== undefined) temp = temp.filter(r => r.pricePerSeat <= filters.maxPrice);
      if (filters.minRating !== undefined) temp = temp.filter(r => r.driverRating >= filters.minRating);
      if (filters.verifiedOnly) temp = temp.filter(r => r.isDriverVerified);
      
      const ranges = filters.departureTimeRanges;
      if (ranges && ranges.length > 0) {
        temp = temp.filter(r => {
          const hour = parseInt(r.departureTime.split(':')[0], 10);
          return ranges.some((range: string) => {
            if (range === 'morning') return hour >= 6 && hour < 12;
            if (range === 'afternoon') return hour >= 12 && hour < 18;
            if (range === 'evening') return hour >= 18 && hour < 24;
            if (range === 'night') return hour >= 0 && hour < 6;
            return false;
          });
        });
      }
      
      // Sort
      if (filters.sortBy === 'price_asc') {
        temp.sort((a, b) => a.pricePerSeat - b.pricePerSeat);
      } else if (filters.sortBy === 'time_asc') {
        temp.sort((a, b) => {
          const aTime = a.departureDate + 'T' + a.departureTime;
          const bTime = b.departureDate + 'T' + b.departureTime;
          return aTime.localeCompare(bTime);
        });
      } else if (filters.sortBy === 'rating_desc') {
        temp.sort((a, b) => b.driverRating - a.driverRating);
      }
      
      results = temp;
    } else {
      // Build Dynamic Postgres SQL Query
      let q = `
        SELECT r.*, 
               u.name AS driver_name, u.photo_url AS driver_photo, u.rating AS driver_rating, 
               TO_CHAR(u.created_at, 'Mon YYYY') AS driver_joined, 
               (SELECT COUNT(*) FROM rides r2 WHERE r2.driver_id = u.id AND r2.status = 'completed') AS driver_trips, 
               u.phone AS driver_phone, 
               u.is_license_verified AS is_driver_verified,
               v.model AS vehicle_model, v.number_plate AS vehicle_plate, v.type AS vehicle_type, v.color AS vehicle_color
        FROM rides r
        JOIN users u ON r.driver_id = u.id
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        WHERE r.status = 'active'
      `;
      const params: any[] = [];
      let pIdx = 1;
      
      if (fromLoc) {
        q += ` AND LOWER(r.start_location) LIKE $${pIdx}`;
        params.push(`%${fromLoc}%`);
        pIdx++;
      }
      
      if (toLoc) {
        q += ` AND LOWER(r.destination) LIKE $${pIdx}`;
        params.push(`%${toLoc}%`);
        pIdx++;
      }
      
      if (depDate) {
        q += ` AND r.departure_date = $${pIdx}`;
        params.push(depDate);
        pIdx++;
      }
      
      if (filters.maxPrice !== undefined) {
        q += ` AND r.price_per_seat <= $${pIdx}`;
        params.push(filters.maxPrice);
        pIdx++;
      }
      
      if (filters.minRating !== undefined) {
        q += ` AND u.rating >= $${pIdx}`;
        params.push(filters.minRating);
        pIdx++;
      }
      
      if (filters.verifiedOnly) {
        q += ` AND u.is_license_verified = TRUE`;
      }
      
      // Departure times
      const ranges = filters.departureTimeRanges;
      if (ranges && ranges.length > 0) {
        const timeConditions: string[] = [];
        ranges.forEach((range: string) => {
          if (range === 'morning') timeConditions.push("CAST(split_part(r.departure_time, ':', 1) AS INT) BETWEEN 6 AND 11");
          if (range === 'afternoon') timeConditions.push("CAST(split_part(r.departure_time, ':', 1) AS INT) BETWEEN 12 AND 17");
          if (range === 'evening') timeConditions.push("CAST(split_part(r.departure_time, ':', 1) AS INT) BETWEEN 18 AND 23");
          if (range === 'night') timeConditions.push("CAST(split_part(r.departure_time, ':', 1) AS INT) BETWEEN 0 AND 5");
        });
        if (timeConditions.length > 0) {
          q += ` AND (${timeConditions.join(' OR ')})`;
        }
      }
      
      // Sorting
      if (filters.sortBy === 'price_asc') {
        q += ' ORDER BY r.price_per_seat ASC';
      } else if (filters.sortBy === 'time_asc') {
        q += ' ORDER BY r.departure_date ASC, r.departure_time ASC';
      } else if (filters.sortBy === 'rating_desc') {
        q += ' ORDER BY u.rating DESC';
      } else {
        q += ' ORDER BY r.departure_date ASC';
      }
      
      const dbRes = await dbQuery(q, params);
      results = dbRes.rows.map((r: any) => formatRideRow(r));
    }
    
    return res.json(results);
  } catch (err: any) {
    console.error('Search Rides Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 4. POST /api/rides (Offer a Ride)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  const rideData = req.body;
  
  if (!rideData.startLocation || !rideData.destination || !rideData.departureDate || !rideData.departureTime) {
    return res.status(400).json({ error: 'Start location, destination, departure date, and time are required' });
  }

  const availableSeats = Number(rideData.availableSeats);
  const totalSeats = Number(rideData.totalSeats);
  const pricePerSeat = Number(rideData.pricePerSeat);

  if (isNaN(totalSeats) || totalSeats <= 0) {
    return res.status(400).json({ error: 'Total seats must be a positive number > 0' });
  }
  if (isNaN(availableSeats) || availableSeats <= 0 || availableSeats > totalSeats) {
    return res.status(400).json({ error: 'Available seats must be between 1 and total seats' });
  }
  if (isNaN(pricePerSeat) || pricePerSeat < 0) {
    return res.status(400).json({ error: 'Price per seat cannot be negative' });
  }

  try {
    const rideId = `ride_${Date.now()}`;
    const vehicle = rideData.vehicle;
    let driver: any = null;
    
    // Step A: Load Driver info
    if (isFallback) {
      driver = memoryDb.users.find(u => u.id === decoded.userId);
    } else {
      const dResult = await dbQuery('SELECT * FROM users WHERE id = $1', [decoded.userId]);
      if (dResult.rows.length > 0) driver = dResult.rows[0];
    }
    
    if (!driver) return res.status(404).json({ error: 'Driver profile not found' });
    
    // Step B: Save vehicle if custom/new
    if (vehicle) {
      if (isFallback) {
        const hasVeh = memoryDb.vehicles.some(v => v.number_plate === vehicle.numberPlate);
        if (!hasVeh) {
          memoryDb.vehicles.push({
            id: vehicle.id,
            user_id: decoded.userId,
            model: vehicle.model,
            number_plate: vehicle.numberPlate,
            type: vehicle.type,
            color: vehicle.color
          });
        }
      } else {
        await dbQuery(
          `INSERT INTO vehicles (id, user_id, model, number_plate, type, color)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (number_plate) DO UPDATE 
           SET model = EXCLUDED.model, color = EXCLUDED.color, type = EXCLUDED.type`,
          [vehicle.id, decoded.userId, vehicle.model, vehicle.numberPlate, vehicle.type, vehicle.color]
        );
      }
    }

    // Step C: Save Ride
    if (isFallback) {
      const newRide = {
        id: rideId,
        driver_id: decoded.userId,
        start_location: rideData.startLocation,
        destination: rideData.destination,
        stops: rideData.stops || [],
        departure_date: rideData.departureDate,
        departure_time: rideData.departureTime,
        arrival_time: rideData.arrivalTime || '12:00',
        available_seats: Number(rideData.availableSeats) || 4,
        total_seats: Number(rideData.totalSeats) || 4,
        price_per_seat: Number(rideData.pricePerSeat) || 300,
        vehicle_id: vehicle ? vehicle.id : null,
        about_ride: rideData.aboutRide || '',
        status: 'active'
      };
      memoryDb.rides.unshift(newRide);
      
      // Return hydrated ride
      return res.json(hydrateRideInMemory(newRide));
    } else {
      const insertRes = await dbQuery(
        `INSERT INTO rides (id, driver_id, start_location, destination, stops, departure_date, departure_time, arrival_time, available_seats, total_seats, price_per_seat, vehicle_id, about_ride, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [
          rideId, decoded.userId, rideData.startLocation, rideData.destination, JSON.stringify(rideData.stops || []),
          rideData.departureDate, rideData.departureTime, rideData.arrivalTime || '12:00',
          Number(rideData.availableSeats) || 4, Number(rideData.totalSeats) || 4, Number(rideData.pricePerSeat) || 300,
          vehicle ? vehicle.id : null, rideData.aboutRide || '', 'active'
        ]
      );
      
      // Query fully populated
      const fullRes = await dbQuery(
        `SELECT r.*, 
               u.name AS driver_name, u.photo_url AS driver_photo, u.rating AS driver_rating, 
               u.joined_date AS driver_joined, u.trips_count AS driver_trips, u.phone AS driver_phone, 
               u.is_license_verified AS is_driver_verified,
               v.model AS vehicle_model, v.number_plate AS vehicle_plate, v.type AS vehicle_type, v.color AS vehicle_color
        FROM rides r
        JOIN users u ON r.driver_id = u.id
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        WHERE r.id = $1`,
        [rideId]
      );
      
      return res.json(formatRideRow(fullRes.rows[0]));
    }
  } catch (err: any) {
    console.error('Create Ride Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 5. GET /api/rides/driver/:driverId
router.get('/driver/:driverId', async (req: Request, res: Response) => {
  const { driverId } = req.params;
  
  try {
    let list: any[] = [];
    
    if (isFallback) {
      list = memoryDb.rides.filter(r => r.driver_id === driverId).map(r => hydrateRideInMemory(r));
    } else {
      const q = `
        SELECT r.*, 
               u.name AS driver_name, u.photo_url AS driver_photo, u.rating AS driver_rating, 
               TO_CHAR(u.created_at, 'Mon YYYY') AS driver_joined, 
               (SELECT COUNT(*) FROM rides r2 WHERE r2.driver_id = u.id AND r2.status = 'completed') AS driver_trips, 
               u.phone AS driver_phone, 
               u.is_license_verified AS is_driver_verified,
               v.model AS vehicle_model, v.number_plate AS vehicle_plate, v.type AS vehicle_type, v.color AS vehicle_color
        FROM rides r
        JOIN users u ON r.driver_id = u.id
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        WHERE r.driver_id = $1
        ORDER BY r.departure_date DESC
      `;
      const result = await dbQuery(q, [driverId]);
      list = result.rows.map((r: any) => formatRideRow(r));
    }
    
    return res.json(list);
  } catch (err: any) {
    console.error('Fetch Driver Rides Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 6. POST /api/rides/:id/cancel
router.post('/:id/cancel', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const decoded = (req as any).user;
  
  try {
    if (isFallback) {
      const ride = memoryDb.rides.find(r => r.id === id);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      if (ride.driver_id !== decoded.userId) {
        return res.status(403).json({ error: 'Unauthorized: Only the ride driver can cancel this ride' });
      }
      
      ride.status = 'cancelled';
      // Cancel all bookings associated with this ride
      memoryDb.bookings.forEach(b => {
        if (b.ride_id === id) {
          b.status = 'cancelled';
          b.payment_status = 'Refunded';
        }
      });
      return res.json(true);
    } else {
      const pgClient = await pool?.connect();
      if (!pgClient) return res.status(500).json({ error: 'DB pool offline' });
      
      try {
        await pgClient.query('BEGIN');
        
        const rRes = await pgClient.query('SELECT * FROM rides WHERE id = $1 FOR UPDATE', [id]);
        if (rRes.rows.length === 0) {
          await pgClient.query('ROLLBACK');
          return res.status(404).json({ error: 'Ride not found' });
        }
        
        const ride = rRes.rows[0];
        if (ride.driver_id !== decoded.userId) {
          await pgClient.query('ROLLBACK');
          return res.status(403).json({ error: 'Unauthorized: Only the ride driver can cancel this ride' });
        }
        
        // Update ride status to cancelled
        await pgClient.query("UPDATE rides SET status = 'cancelled' WHERE id = $1", [id]);
        
        // Mark all bookings as cancelled
        await pgClient.query(
          "UPDATE bookings SET status = 'cancelled', payment_status = 'Refunded' WHERE ride_id = $1",
          [id]
        );
        
        await pgClient.query('COMMIT');
        return res.json(true);
      } catch (err) {
        await pgClient.query('ROLLBACK');
        throw err;
      } finally {
        pgClient.release();
      }
    }
  } catch (err: any) {
    console.error('Cancel Ride Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 7. POST /api/rides/:id/seats (Update seats count)
router.post('/:id/seats', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { availableSeats } = req.body;
  const decoded = (req as any).user;

  try {
    if (isFallback) {
      const ride = memoryDb.rides.find(r => r.id === id);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      if (ride.driver_id !== decoded.userId) {
        return res.status(403).json({ error: 'Unauthorized: Only the ride driver can update seats' });
      }
      
      const seats = Number(availableSeats);
      if (isNaN(seats) || seats < 0 || seats > ride.total_seats) {
        return res.status(400).json({ error: `Available seats must be between 0 and total seats (${ride.total_seats})` });
      }
      
      ride.available_seats = seats;
      return res.json(true);
    } else {
      const pgClient = await pool?.connect();
      if (!pgClient) return res.status(500).json({ error: 'DB pool offline' });
      
      try {
        await pgClient.query('BEGIN');
        
        const rRes = await pgClient.query('SELECT * FROM rides WHERE id = $1 FOR UPDATE', [id]);
        if (rRes.rows.length === 0) {
          await pgClient.query('ROLLBACK');
          return res.status(404).json({ error: 'Ride not found' });
        }
        
        const ride = rRes.rows[0];
        if (ride.driver_id !== decoded.userId) {
          await pgClient.query('ROLLBACK');
          return res.status(403).json({ error: 'Unauthorized: Only the ride driver can update seats' });
        }
        
        const seats = Number(availableSeats);
        if (isNaN(seats) || seats < 0 || seats > ride.total_seats) {
          await pgClient.query('ROLLBACK');
          return res.status(400).json({ error: `Available seats must be between 0 and total seats (${ride.total_seats})` });
        }
        
        await pgClient.query('UPDATE rides SET available_seats = $1 WHERE id = $2', [seats, id]);
        await pgClient.query('COMMIT');
        return res.json(true);
      } catch (err) {
        await pgClient.query('ROLLBACK');
        throw err;
      } finally {
        pgClient.release();
      }
    }
  } catch (err: any) {
    console.error('Update Ride Seats Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Helper formatting row mappings
function formatRideRow(r: any) {
  return {
    id: r.id,
    driverId: r.driver_id,
    driverName: r.driver_name,
    driverPhoto: r.driver_photo,
    driverRating: Number(r.driver_rating),
    driverJoined: r.driver_joined,
    driverTrips: r.driver_trips,
    driverPhone: r.driver_phone,
    isDriverVerified: r.is_driver_verified,
    startLocation: r.start_location,
    destination: r.destination,
    stops: typeof r.stops === 'string' ? JSON.parse(r.stops) : r.stops,
    departureDate: r.departure_date,
    departureTime: r.departure_time,
    arrivalTime: r.arrival_time,
    availableSeats: r.available_seats,
    totalSeats: r.total_seats,
    pricePerSeat: r.price_per_seat,
    vehicle: {
      id: r.vehicle_id,
      model: r.vehicle_model,
      numberPlate: r.vehicle_plate,
      type: r.vehicle_type,
      color: r.vehicle_color
    },
    aboutRide: r.about_ride,
    status: r.status
  };
}

function formatJoinedDate(dateInput: any): string {
  const date = new Date(dateInput || Date.now());
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function hydrateRideInMemory(r: any) {
  const driver = memoryDb.users.find(u => u.id === r.driver_id);
  const vehicle = memoryDb.vehicles.find(v => v.id === r.vehicle_id);
  const completedRidesCount = memoryDb.rides.filter(r2 => r2.driver_id === r.driver_id && r2.status === 'completed').length;
  return {
    id: r.id,
    driverId: r.driver_id,
    driverName: driver ? driver.name : '',
    driverPhoto: driver ? driver.photo_url : '',
    driverRating: driver ? Number(driver.rating) : 5.0,
    driverJoined: driver ? formatJoinedDate(driver.created_at) : '',
    driverTrips: completedRidesCount,
    driverPhone: driver ? driver.phone : '',
    isDriverVerified: driver ? driver.is_license_verified : false,
    startLocation: r.start_location,
    destination: r.destination,
    stops: r.stops,
    departureDate: r.departure_date,
    departureTime: r.departure_time,
    arrivalTime: r.arrival_time,
    availableSeats: r.available_seats,
    totalSeats: r.total_seats,
    pricePerSeat: r.price_per_seat,
    vehicle: vehicle ? {
      id: vehicle.id,
      model: vehicle.model,
      numberPlate: vehicle.number_plate,
      type: vehicle.type,
      color: vehicle.color
    } : undefined,
    aboutRide: r.about_ride,
    status: r.status || 'active'
  };
}

export default router;
