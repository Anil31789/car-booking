import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import authRoutes from './routes/auth.routes.js';
import rideRoutes from './routes/ride.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import userRoutes from './routes/user.routes.js';
import notificationRoutes from './routes/notification.routes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:4000'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Basic Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'UP' });
});

// Start server
async function startServer() {
  await initDatabase();
  app.listen(port, () => {
    console.log(`HighwayPool Backend Server listening on http://localhost:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start HighwayPool backend server:', err);
});
