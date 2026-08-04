"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const fs_1 = require("fs");
const path_1 = require("path");
const db_js_1 = require("./db.js");
const auth_routes_js_1 = __importDefault(require("./routes/auth.routes.js"));
const ride_routes_js_1 = __importDefault(require("./routes/ride.routes.js"));
const booking_routes_js_1 = __importDefault(require("./routes/booking.routes.js"));
const user_routes_js_1 = __importDefault(require("./routes/user.routes.js"));
const notification_routes_js_1 = __importDefault(require("./routes/notification.routes.js"));
const email_service_js_1 = require("./services/email.service.js");
dotenv_1.default.config();
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
    const packageJsonPath = (0, path_1.join)(__dirname, 'package.json');
    const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf8'));
    appVersion = packageJson.version || '1.0.0';
}
catch (e) {
    // fallback if file not found or failed parsing
}
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// Enable trust proxy for correct client IP detection behind reverse proxies (Nginx / Passenger)
app.set('trust proxy', 1);
// Add security headers using Helmet
app.use((0, helmet_1.default)());
// Dynamic CORS configuration
let allowedOrigins = [];
if (process.env.ALLOWED_ORIGINS) {
    allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
}
else if (process.env.NODE_ENV !== 'production') {
    allowedOrigins = ['http://localhost:4200', 'http://localhost:4000'];
}
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl/postman)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Blocked by CORS policy'));
        }
    },
    credentials: true
}));
app.use(express_1.default.json());
// Global Rate Limiting for all API requests
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api', globalLimiter);
// Register routes
app.use('/api/auth', auth_routes_js_1.default);
app.use('/api/rides', ride_routes_js_1.default);
app.use('/api/bookings', booking_routes_js_1.default);
app.use('/api/users', user_routes_js_1.default);
app.use('/api/notifications', notification_routes_js_1.default);
// Comprehensive Healthcheck Endpoint
app.get('/health', async (req, res) => {
    let dbStatus = 'DOWN';
    if (!db_js_1.isFallback && db_js_1.pool) {
        try {
            await db_js_1.pool.query('SELECT 1');
            dbStatus = 'CONNECTED';
        }
        catch (err) {
            dbStatus = 'ERROR';
        }
    }
    else if (db_js_1.isFallback) {
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
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ error: 'Internal Server Error' });
    }
    else {
        res.status(500).json({ error: err.message || 'Internal Server Error', stack: err.stack });
    }
});
let server;
// Start server function
async function startServer() {
    await (0, db_js_1.initDatabase)();
    if (email_service_js_1.emailProvider.verifyConnection) {
        await email_service_js_1.emailProvider.verifyConnection();
    }
    server = app.listen(port, () => {
        console.log(`HighwayPool Backend Server listening on port ${port} (mode: ${process.env.NODE_ENV || 'development'})`);
    });
}
startServer().catch(err => {
    console.error('Failed to start HighwayPool backend server:', err);
});
// Graceful Shutdown Handlers
function handleGracefulShutdown(signal) {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    if (server) {
        server.close(async () => {
            console.log('Express HTTP server closed.');
            try {
                await (0, db_js_1.closeDatabase)();
                console.log('Database connections ended.');
                console.log('Graceful shutdown finished. Exiting process.');
                process.exit(0);
            }
            catch (dbErr) {
                console.error('Error closing database connections during shutdown:', dbErr);
                process.exit(1);
            }
        });
        // Force shutdown after 10s if hanging
        setTimeout(() => {
            console.error('Shutdown timed out. Forcefully exiting.');
            process.exit(1);
        }, 10000);
    }
    else {
        process.exit(0);
    }
}
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
