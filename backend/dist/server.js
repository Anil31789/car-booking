"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_js_1 = require("./db.js");
const auth_routes_js_1 = __importDefault(require("./routes/auth.routes.js"));
const ride_routes_js_1 = __importDefault(require("./routes/ride.routes.js"));
const booking_routes_js_1 = __importDefault(require("./routes/booking.routes.js"));
const user_routes_js_1 = __importDefault(require("./routes/user.routes.js"));
const notification_routes_js_1 = __importDefault(require("./routes/notification.routes.js"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)({
    origin: ['http://localhost:4200', 'http://localhost:4000'],
    credentials: true
}));
app.use(express_1.default.json());
// Routes
app.use('/api/auth', auth_routes_js_1.default);
app.use('/api/rides', ride_routes_js_1.default);
app.use('/api/bookings', booking_routes_js_1.default);
app.use('/api/users', user_routes_js_1.default);
app.use('/api/notifications', notification_routes_js_1.default);
// Basic Healthcheck
app.get('/health', (req, res) => {
    res.json({ status: 'UP' });
});
// Start server
async function startServer() {
    await (0, db_js_1.initDatabase)();
    app.listen(port, () => {
        console.log(`HighwayPool Backend Server listening on http://localhost:${port}`);
    });
}
startServer().catch(err => {
    console.error('Failed to start HighwayPool backend server:', err);
});
