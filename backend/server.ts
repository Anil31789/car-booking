import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { generalLimiter } from './middleware/rate-limiter.js';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { initDatabase, closeDatabase, pool, isFallback } from './db.js';
import authRoutes from './routes/auth.routes.js';
import rideRoutes from './routes/ride.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import userRoutes from './routes/user.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import { emailProvider } from './services/email.service.js';
import passport from './config/passport.js';

// Ensure persistent uploads directory exists
export const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
try {
  mkdirSync(join(UPLOADS_DIR, 'profile-photos'), { recursive: true });
} catch (e) {
  // Directory exists or created
}

// Validate required environment variables in production
const requiredEnv = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'ALLOWED_ORIGINS',
  'API_BASE_URL',
  'LOCATION_PROVIDER',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'FRONTEND_BASE_URL'
];
const missingEnv = requiredEnv.filter(k => !process.env[k]);

if (process.env.NODE_ENV === 'production') {
  if (missingEnv.length > 0) {
    console.error(`FATAL CONFIGURATION ERROR: Missing required production environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
  }
  
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'highwaypool_supersecret_jwt_token_key_2026') {
    console.error('FATAL CONFIGURATION ERROR: JWT_SECRET must be configured and cannot use the default development key in production.');
    process.exit(1);
  }
}

// Load Application Version from package.json
let appVersion = '1.0.0';
try {
  const packageJsonPath = join(__dirname, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  appVersion = packageJson.version || '1.0.0';
} catch (e) {
  // fallback if file not found or failed parsing
}

const app = express();
const port = process.env.PORT || 5000;

// Enable trust proxy for correct client IP detection behind reverse proxies (Nginx / Passenger)
app.set('trust proxy', 1);

// Add security headers using Helmet (allow cross-origin resources for public static media/photos)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Dynamic CORS configuration
let allowedOrigins: string[] = [];
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
} else {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (!process.env.FRONTEND_BASE_URL) {
      console.error('FATAL CONFIGURATION ERROR: FRONTEND_BASE_URL environment variable is required in production!');
      process.exit(1);
    }
    allowedOrigins = [process.env.FRONTEND_BASE_URL];
  } else {
    const frontendUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:4200';
    allowedOrigins = [frontendUrl, 'http://localhost:4200', 'http://localhost:4000'];
  }
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl/postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(passport.initialize());

// Serve static uploads (profile photos) both at /uploads and /api/uploads for flexible proxy/hosting
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/api/uploads', express.static(UPLOADS_DIR));

// Global Rate Limiting for all API requests
app.use('/api', generalLimiter);

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Comprehensive Healthcheck Endpoint
app.get('/health', async (req, res) => {
  let dbStatus = 'DOWN';
  if (!isFallback && pool) {
    try {
      await pool.query('SELECT 1');
      dbStatus = 'CONNECTED';
    } catch (err) {
      dbStatus = 'ERROR';
    }
  } else if (isFallback) {
    dbStatus = 'IN-MEMORY-FALLBACK';
  }
  
  res.json({
    status: 'UP',
    version: appVersion,
    database: dbStatus,
    uptime: process.uptime()
  });
});

// Global Error Handler (Mask stack traces in production)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal Server Error' });
  } else {
    res.status(500).json({ error: err.message || 'Internal Server Error', stack: err.stack });
  }
});

let server: any;

// Start server function
async function startServer() {
  await initDatabase();
  
  if (emailProvider.verifyConnection) {
    await emailProvider.verifyConnection();
  }

  server = app.listen(port, () => {
    console.log(`HighwayPool Backend Server listening on port ${port} (mode: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start HighwayPool backend server:', err);
});

// Graceful Shutdown Handlers
function handleGracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('Express HTTP server closed.');
      try {
        await closeDatabase();
        console.log('Database connections ended.');
        console.log('Graceful shutdown finished. Exiting process.');
        process.exit(0);
      } catch (dbErr) {
        console.error('Error closing database connections during shutdown:', dbErr);
        process.exit(1);
      }
    });
    
    // Force shutdown after 10s if hanging
    setTimeout(() => {
      console.error('Shutdown timed out. Forcefully exiting.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
