import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

export let pool: pg.Pool | null = null;
export let isFallback = false;

export function setFallback(val: boolean) {
  isFallback = val;
}

// Fallback Memory Database State
export let memoryDb = {
  users: [] as any[],
  vehicles: [] as any[],
  rides: [] as any[],
  bookings: [] as any[],
  reviews: [] as any[],
  refreshTokens: [] as any[],
  notifications: [] as any[]
};

export async function initDatabase() {
  try {
    console.log('Connecting to PostgreSQL database...');
    const isNeon = connectionString?.includes('neon.tech') || false;
    const isProd = process.env.NODE_ENV === 'production';
    const useSsl = isNeon || isProd;

    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
      max: 10,
      idleTimeoutMillis: 30000,
      ssl: useSsl ? { rejectUnauthorized: false } : false
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
    
    // Test connection
    const client = await pool.connect();
    client.release();
    console.log('Successfully connected to PostgreSQL database!');
    
    // Create schema
    await runSchemaDDL();
    
    // Seed database if empty
    await seedDatabaseIfNeeded();
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production') {
      console.error('--------------------------------------------------');
      console.error('FATAL ERROR: Failed to connect to PostgreSQL database in production.');
      console.error('Error message:', err.message || err);
      console.error('Application will exit now.');
      console.error('--------------------------------------------------');
      process.exit(1);
    }

    console.warn('--------------------------------------------------');
    console.warn('WARNING: Failed to connect to PostgreSQL database.');
    console.warn('Error message:', err.message || err);
    console.warn('Falling back to a fully functional IN-MEMORY database.');
    console.warn('Check your DATABASE_URL in backend/.env to connect to PostgreSQL.');
    console.warn('--------------------------------------------------');
    isFallback = true;
    pool = null;
    
    // Initialize & seed in-memory database
    generateMemoryMockData();
  }
}

async function runSchemaDDL() {
  if (!pool) return;
  
  const schemaDDL = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      phone VARCHAR(50) UNIQUE NOT NULL,
      photo_url TEXT,
      is_mobile_verified BOOLEAN DEFAULT TRUE,
      is_email_verified BOOLEAN DEFAULT FALSE,
      license_placeholder VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      rating DECIMAL(3, 2) DEFAULT 5.00,
      reviews_count INT DEFAULT 0,
      license_number VARCHAR(100),
      is_license_verified BOOLEAN DEFAULT FALSE,
      joined_date VARCHAR(50) DEFAULT 'Today',
      trips_count INT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
      model VARCHAR(100) NOT NULL,
      number_plate VARCHAR(50) UNIQUE NOT NULL,
      type VARCHAR(50) CHECK (type IN ('Sedan', 'Hatchback', 'SUV', 'EV', 'Luxury')),
      color VARCHAR(50) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rides (
      id VARCHAR(100) PRIMARY KEY,
      driver_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
      start_location VARCHAR(100) NOT NULL,
      destination VARCHAR(100) NOT NULL,
      stops JSONB DEFAULT '[]'::jsonb,
      departure_date VARCHAR(50) NOT NULL,
      departure_time VARCHAR(20) NOT NULL,
      arrival_time VARCHAR(20) NOT NULL,
      available_seats INT NOT NULL,
      total_seats INT NOT NULL,
      price_per_seat INT NOT NULL,
      vehicle_id VARCHAR(100) REFERENCES vehicles(id) ON DELETE SET NULL,
      about_ride TEXT,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id VARCHAR(100) PRIMARY KEY,
      ride_id VARCHAR(100) REFERENCES rides(id) ON DELETE CASCADE,
      passenger_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
      seats_booked INT NOT NULL,
      total_price INT NOT NULL,
      status VARCHAR(20) CHECK (status IN ('pending', 'upcoming', 'completed', 'cancelled')),
      booking_date VARCHAR(50) NOT NULL,
      payment_method VARCHAR(20) CHECK (payment_method IN ('UPI', 'Card', 'Wallet', 'Cash')),
      payment_status VARCHAR(20) CHECK (payment_status IN ('Paid', 'Refunded', 'Pending')),
      selected_seats INT[] DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id VARCHAR(100) PRIMARY KEY,
      driver_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
      reviewer_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
      reviewer_name VARCHAR(100) NOT NULL,
      reviewer_photo TEXT,
      rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      booking_id VARCHAR(100) REFERENCES bookings(id) ON DELETE SET NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      booking_id VARCHAR(100) REFERENCES bookings(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
    CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
    CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
    CREATE INDEX IF NOT EXISTS idx_bookings_ride_id ON bookings(ride_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON bookings(passenger_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_reviews_driver_id ON reviews(driver_id);
  `;
  
  await pool.query(schemaDDL);

  // Run migrations/ALTER statements if needed
  try {
    // 1. Add status to rides if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rides' AND column_name='status') THEN
          ALTER TABLE rides ADD COLUMN status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed'));
        END IF;
      END $$;
    `);

    // 2. Add booking_id to reviews if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='booking_id') THEN
          ALTER TABLE reviews ADD COLUMN booking_id VARCHAR(100) REFERENCES bookings(id) ON DELETE SET NULL UNIQUE;
        END IF;
      END $$;
    `);

    // 3. Drop and recreate check constraints on bookings table
    await pool.query(`
      ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
      ALTER TABLE bookings ADD CONSTRAINT bookings_payment_method_check CHECK (payment_method IN ('UPI', 'Card', 'Wallet', 'Cash'));
      
      ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
      ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'upcoming', 'completed', 'cancelled'));
    `);

    // 4. Add selected_seats column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='selected_seats') THEN
          ALTER TABLE bookings ADD COLUMN selected_seats INT[] DEFAULT '{}';
        END IF;
      END $$;
    `);

    // 5. Add authentication columns and alter constraints on users table
    await pool.query(`
      ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
      
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_verified') THEN
          ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
          ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='google_id') THEN
          ALTER TABLE users ADD COLUMN google_id VARCHAR(100) UNIQUE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='auth_provider') THEN
          ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'local';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_verification_token') THEN
          ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(100);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_verification_expiry') THEN
          ALTER TABLE users ADD COLUMN email_verification_expiry TIMESTAMP;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_reset_token') THEN
          ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(100);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_reset_expiry') THEN
          ALTER TABLE users ADD COLUMN password_reset_expiry TIMESTAMP;
        END IF;
      END $$;
    `);
  } catch (migErr) {
    console.error('Migration error (non-fatal if tables did not exist yet):', migErr);
  }

  const triggerSQL = `
    CREATE OR REPLACE FUNCTION restore_seats_on_booking_delete()
    RETURNS TRIGGER AS $$
    BEGIN
      IF OLD.status = 'upcoming' THEN
        UPDATE rides 
        SET available_seats = LEAST(total_seats, available_seats + OLD.seats_booked)
        WHERE id = OLD.ride_id;
      END IF;
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_restore_seats ON bookings;
    CREATE TRIGGER trigger_restore_seats
    BEFORE DELETE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION restore_seats_on_booking_delete();
  `;
  await pool.query(triggerSQL);
  
  console.log('Database tables and triggers verified/created successfully.');
}

// Global DB queries dispatcher
export async function dbQuery(text: string, params: any[] = []): Promise<any> {
  if (isFallback || !pool) {
    throw new Error('Database is running in in-memory fallback mode.');
  }
  return pool.query(text, params);
}

// Global Notification Creator
export async function createNotification(userId: string, title: string, message: string, type: string, bookingId?: string) {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  if (isFallback || !pool) {
    memoryDb.notifications.unshift({
      id,
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date(),
      booking_id: bookingId || null
    });
    console.log(`[MemoryDB Notification] Created for ${userId}: ${title}`);
  } else {
    try {
      await pool.query(
        `INSERT INTO notifications (id, user_id, title, message, type, is_read, booking_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, userId, title, message, type, false, bookingId || null]
      );
      console.log(`[PostgreSQL Notification] Created for ${userId}: ${title}`);
    } catch (err) {
      console.error('Failed to create notification in PostgreSQL:', err);
    }
  }
}

// Generate the standard mock data for seeding
function getMockDataSet() {
  const drivers: any[] = [];
  const reviews: any[] = [];
  const rides: any[] = [];
  const bookings: any[] = [];
  const vehicles: any[] = [];

  const indianNames = [
    'Amit Sharma', 'Rahul Verma', 'Priya Patel', 'Siddharth Rao', 'Neha Gupta',
    'Vikram Singh', 'Ananya Nair', 'Rohan Mehta', 'Sneha Reddy', 'Aditya Joshi',
    'Karan Malhotra', 'Deepak Kumar', 'Pooja Choudhary', 'Arjun Saxena', 'Ritu Mishra',
    'Sanjay Dutt', 'Divya Iyer', 'Abhishek Banerjee', 'Shalini Sen', 'Manish Pandey'
  ];

  const carModels = [
    { model: 'Hyundai i20', type: 'Hatchback', color: 'Polar White' },
    { model: 'Maruti Swift', type: 'Hatchback', color: 'Midnight Blue' },
    { model: 'Honda City', type: 'Sedan', color: 'Golden Brown' },
    { model: 'Hyundai Verna', type: 'Sedan', color: 'Phantom Black' },
    { model: 'Tata Nexon', type: 'SUV', color: 'Foliage Green' },
    { model: 'Mahindra XUV700', type: 'SUV', color: 'Everest White' },
    { model: 'Toyota Fortuner', type: 'SUV', color: 'Attitude Black' },
    { model: 'Tata Nexon EV', type: 'EV', color: 'Signature Teal' },
    { model: 'MG ZS EV', type: 'EV', color: 'Aurora Silver' },
    { model: 'BMW 3 Series', type: 'Luxury', color: 'Portimao Blue' }
  ];

  const reviewComments = [
    'Very professional driver. Drove safely throughout the highway.',
    'Extremely clean vehicle! Offered water bottles and had great playlist.',
    'Punctual and helpful with heavy bags. Highly recommended ride.',
    'Good conversationalist. The 3-hour journey Mumbai to Pune felt like 30 minutes!',
    'Smooth driving, respected speed limits. Will definitely book again.',
    'A bit delayed due to traffic near toll plaza, but otherwise a very comfortable ride.',
    'Safe driving. Masked and sanitized car.',
    'Very pleasant journey. Helpful with dynamic stops.',
    'Excellent driving skills, especially in night hours. The SUV was luxurious.',
    'Friendly nature. Very neat and tidy Sedan.'
  ];

  // 1. Generate 20 Drivers
  for (let i = 0; i < 20; i++) {
    const name = indianNames[i];
    const reviewsCount = 5 + Math.floor(Math.random() * 15);
    const driverCar = carModels[i % carModels.length];
    const driverId = `drv_${i + 1}`;
    
    // Generate Reviews for this driver first to compute average rating
    const driverReviewRatings: number[] = [];
    for (let r = 0; r < reviewsCount; r++) {
      const reviewerIndex = (i + r) % indianNames.length;
      const comment = reviewComments[(i + r) % reviewComments.length];
      const reviewDate = new Date();
      reviewDate.setDate(reviewDate.getDate() - (r * 3 + 1));
      
      const reviewRating = Math.floor(4 + Math.random() * 2); // 4 or 5 stars
      driverReviewRatings.push(reviewRating);
      
      reviews.push({
        id: `rev_${driverId}_${r + 1}`,
        driver_id: driverId,
        reviewer_id: null,
        reviewer_name: indianNames[reviewerIndex],
        reviewer_photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(indianNames[reviewerIndex])}`,
        rating: reviewRating,
        comment: comment,
        created_at: reviewDate
      });
    }

    const totalReviewSum = driverReviewRatings.reduce((sum, current) => sum + current, 0);
    const avgRating = Number((totalReviewSum / reviewsCount).toFixed(1));

    drivers.push({
      id: driverId,
      name: name,
      email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
      phone: `+91 980000000${i}`,
      photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      is_mobile_verified: true,
      is_email_verified: true,
      license_placeholder: `DL-${700000 + i}MH`,
      rating: avgRating,
      reviews_count: reviewsCount,
      license_number: `DL-XXXXXX${4000 + i}`,
      is_license_verified: i % 4 !== 0,
      joined_date: `Feb 2024`,
      trips_count: 20 + Math.floor(Math.random() * 80),
      email_verified: true,
      password_hash: '$2b$10$V.0e99X5g/UR8QsyYXsKp.Ih10PvKzmsZlsVA9p00FeBciA6fZY0C',
      auth_provider: 'local'
    });

    const vehId = `veh_drv_${i + 1}_1`;
    vehicles.push({
      id: vehId,
      user_id: driverId,
      model: driverCar.model,
      number_plate: `MH-12-${i % 2 === 0 ? 'AB' : 'XY'}-${2000 + i}`,
      type: driverCar.type,
      color: driverCar.color
    });
  }

  // 2. Generate 50 Rides
  const routesConfig = [
    { from: 'Mumbai', to: 'Pune', duration: 3, distance: 150, basePrice: 350, stops: ['Navi Mumbai', 'Lonavala'] },
    { from: 'Nagpur', to: 'Pune', duration: 13, distance: 710, basePrice: 1100, stops: ['Amravati', 'Jalna', 'Ahmednagar'] },
    { from: 'Nagpur', to: 'Mumbai', duration: 14, distance: 800, basePrice: 1300, stops: ['Amravati', 'Aurangabad', 'Nashik'] },
    { from: 'Hyderabad', to: 'Bangalore', duration: 10, distance: 570, basePrice: 950, stops: ['Kurnool', 'Anantapur'] },
    { from: 'Mumbai', to: 'Nashik', duration: 4, distance: 170, basePrice: 400, stops: ['Thane', 'Kalyan'] },
    { from: 'Pune', to: 'Mumbai', duration: 3, distance: 150, basePrice: 350, stops: ['Lonavala', 'Navi Mumbai'] },
    { from: 'Pune', to: 'Nagpur', duration: 13, distance: 710, basePrice: 1100, stops: ['Ahmednagar', 'Jalna', 'Amravati'] }
  ];

  const today = new Date();
  
  for (let i = 0; i < 50; i++) {
    const route = routesConfig[i % routesConfig.length];
    const driverIndex = i % drivers.length;
    const driver = drivers[driverIndex];
    const vehicle = vehicles[driverIndex]; // link to driver vehicle
    
    const departure = new Date(today);
    const dayOffset = (i % 8) - 1;
    departure.setDate(today.getDate() + dayOffset);
    
    const hour = 6 + (i * 3) % 16;
    const minutes = (i % 2 === 0) ? '00' : '30';
    const depTimeStr = `${hour < 10 ? '0' + hour : hour}:${minutes}`;
    
    const arrHour = (hour + route.duration) % 24;
    const arrTimeStr = `${arrHour < 10 ? '0' + arrHour : arrHour}:${minutes}`;
    
    const totalSeats = vehicle.type === 'SUV' || vehicle.type === 'Luxury' ? 6 : 4;
    const availableSeats = 1 + Math.floor(Math.random() * (totalSeats - 1));

    const stops = route.stops.map((stopName, idx) => {
      const stopHour = (hour + Math.floor((idx + 1) * (route.duration / (route.stops.length + 1)))) % 24;
      return {
        name: stopName,
        arrivalTime: `${stopHour < 10 ? '0' + stopHour : stopHour}:${minutes}`
      };
    });

    rides.push({
      id: `ride_${i + 1}`,
      driver_id: driver.id,
      start_location: route.from,
      destination: route.to,
      stops: stops,
      departure_date: departure.toISOString().split('T')[0],
      departure_time: depTimeStr,
      arrival_time: arrTimeStr,
      available_seats: availableSeats,
      total_seats: totalSeats,
      price_per_seat: Math.round(route.basePrice * (0.9 + Math.random() * 0.2)),
      vehicle_id: vehicle.id,
      about_ride: `Hey! I am driving down to ${route.to} for business purposes. Safe driving is my priority. Luggage space is available in the boot. Please book your seats in advance!`,
      status: 'active'
    });
  }

  // 3. Setup Default Logged In User
  const defaultUser = {
    id: 'usr_me',
    name: 'Rohan Deshmukh',
    email: 'rohan.deshmukh@gmail.com',
    phone: '+91 9988776655',
    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan',
    is_mobile_verified: true,
    is_email_verified: true,
    license_placeholder: 'DL-812398MH',
    rating: 5.0,
    reviews_count: 0,
    license_number: 'DL-812398MH',
    is_license_verified: true,
    joined_date: 'Jan 2025',
    trips_count: 0,
    email_verified: true,
    password_hash: '$2b$10$V.0e99X5g/UR8QsyYXsKp.Ih10PvKzmsZlsVA9p00FeBciA6fZY0C',
    auth_provider: 'local'
  };
  drivers.push(defaultUser);

  const defaultUserVeh1 = {
    id: 'veh_me_1',
    user_id: defaultUser.id,
    model: 'Honda City',
    number_plate: 'MH-12-HC-1029',
    type: 'Sedan',
    color: 'Golden Brown'
  };
  const defaultUserVeh2 = {
    id: 'veh_me_2',
    user_id: defaultUser.id,
    model: 'Tata Nexon',
    number_plate: 'MH-12-TN-4890',
    type: 'SUV',
    color: 'Foliage Green'
  };
  vehicles.push(defaultUserVeh1, defaultUserVeh2);

  // 4. Create some initial bookings for default user
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const pastRide = rides.find(r => r.departure_date === yesterday.toISOString().split('T')[0]);
  if (pastRide) {
    bookings.push({
      id: 'bk_1',
      ride_id: pastRide.id,
      passenger_id: defaultUser.id,
      seats_booked: 2,
      total_price: pastRide.price_per_seat * 2,
      status: 'completed',
      booking_date: yesterday.toISOString().split('T')[0],
      payment_method: 'UPI',
      payment_status: 'Paid',
      selected_seats: [1, 2]
    });
    bookings.push({
      id: 'bk_3',
      ride_id: pastRide.id,
      passenger_id: defaultUser.id,
      seats_booked: 1,
      total_price: pastRide.price_per_seat,
      status: 'upcoming',
      booking_date: yesterday.toISOString().split('T')[0],
      payment_method: 'Cash',
      payment_status: 'Pending',
      selected_seats: [3]
    });
  }

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const upcomingRide = rides.find(r => r.departure_date === tomorrow.toISOString().split('T')[0]);
  if (upcomingRide) {
    bookings.push({
      id: 'bk_2',
      ride_id: upcomingRide.id,
      passenger_id: defaultUser.id,
      seats_booked: 1,
      total_price: upcomingRide.price_per_seat,
      status: 'upcoming',
      booking_date: today.toISOString().split('T')[0],
      payment_method: 'Wallet',
      payment_status: 'Paid',
      selected_seats: [1]
    });
  }

  return { drivers, vehicles, rides, reviews, bookings };
}

function generateMemoryMockData() {
  const data = getMockDataSet();
  memoryDb.users = data.drivers;
  memoryDb.vehicles = data.vehicles;
  memoryDb.rides = data.rides;
  memoryDb.reviews = data.reviews;
  memoryDb.bookings = data.bookings;
  console.log(`Fallback in-memory DB seeded. Users: ${memoryDb.users.length}, Rides: ${memoryDb.rides.length}`);
}

async function seedDatabaseIfNeeded() {
  if (!pool) return;
  
  const userCheck = await pool.query('SELECT COUNT(*) FROM users');
  const userCount = parseInt(userCheck.rows[0].count, 10);
  
  if (userCount > 0) {
    console.log('PostgreSQL database already has data. Skipping seeding.');
    return;
  }
  
  console.log('Seeding PostgreSQL database with mock data...');
  const data = getMockDataSet();
  
  // Start transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert Users
    for (const u of data.drivers) {
      await client.query(
        `INSERT INTO users (id, name, email, phone, photo_url, is_mobile_verified, is_email_verified, license_placeholder, rating, reviews_count, license_number, is_license_verified, joined_date, trips_count, email_verified, password_hash, auth_provider)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          u.id, u.name, u.email, u.phone, u.photo_url, u.is_mobile_verified, u.is_email_verified, u.license_placeholder, u.rating, u.reviews_count, u.license_number, u.is_license_verified, u.joined_date, u.trips_count,
          true, '$2b$10$V.0e99X5g/UR8QsyYXsKp.Ih10PvKzmsZlsVA9p00FeBciA6fZY0C', 'local'
        ]
      );
    }
    
    // Insert Vehicles
    for (const v of data.vehicles) {
      await client.query(
        `INSERT INTO vehicles (id, user_id, model, number_plate, type, color)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [v.id, v.user_id, v.model, v.number_plate, v.type, v.color]
      );
    }
    
    // Insert Rides
    for (const r of data.rides) {
      await client.query(
        `INSERT INTO rides (id, driver_id, start_location, destination, stops, departure_date, departure_time, arrival_time, available_seats, total_seats, price_per_seat, vehicle_id, about_ride, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [r.id, r.driver_id, r.start_location, r.destination, JSON.stringify(r.stops), r.departure_date, r.departure_time, r.arrival_time, r.available_seats, r.total_seats, r.price_per_seat, r.vehicle_id, r.about_ride, r.status || 'active']
      );
    }
    
    // Insert Bookings
    for (const b of data.bookings) {
      await client.query(
        `INSERT INTO bookings (id, ride_id, passenger_id, seats_booked, total_price, status, booking_date, payment_method, payment_status, selected_seats)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [b.id, b.ride_id, b.passenger_id, b.seats_booked, b.total_price, b.status, b.booking_date, b.payment_method, b.payment_status, b.selected_seats || []]
      );
    }
    
    // Insert Reviews
    for (const rev of data.reviews) {
      await client.query(
        `INSERT INTO reviews (id, driver_id, reviewer_id, reviewer_name, reviewer_photo, rating, comment, created_at, booking_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [rev.id, rev.driver_id, rev.reviewer_id, rev.reviewer_name, rev.reviewer_photo, rev.rating, rev.comment, rev.created_at, rev.booking_id || null]
      );
    }
    
    await client.query('COMMIT');
    console.log('PostgreSQL database seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to seed PostgreSQL database:', err);
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (pool) {
    console.log('Closing PostgreSQL connection pool...');
    await pool.end();
    console.log('PostgreSQL connection pool closed.');
  }
}
