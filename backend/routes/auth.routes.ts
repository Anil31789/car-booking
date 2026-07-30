import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { dbQuery, isFallback, memoryDb } from '../db.js';

const router = Router();
const JWT_SECRET = process.env.NODE_ENV === 'production' 
  ? process.env.JWT_SECRET! 
  : (process.env.JWT_SECRET || 'highwaypool_supersecret_jwt_token_key_2026');

if (process.env.NODE_ENV === 'production' && (!JWT_SECRET || JWT_SECRET === 'highwaypool_supersecret_jwt_token_key_2026')) {
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be configured and cannot use the default dev key in production.');
}

// Helper to sign Access Token (15 mins)
function generateAccessToken(userId: string, email: string) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '15m' });
}

// Helper to generate and store Refresh Token (7 days)
async function generateAndStoreRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  if (isFallback) {
    if (!memoryDb.refreshTokens) {
      memoryDb.refreshTokens = [];
    }
    memoryDb.refreshTokens.push({ token, user_id: userId, expires_at: expiresAt });
  } else {
    await dbQuery(
      'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [token, userId, expiresAt]
    );
  }
  return token;
}

export async function getUserStats(userId: string): Promise<{ joinedDate: string; tripsCount: number }> {
  if (isFallback) {
    const user = memoryDb.users.find(u => u.id === userId);
    if (!user) return { joinedDate: 'Jun 2026', tripsCount: 0 };
    const date = new Date(user.created_at || Date.now());
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const joinedDate = `${months[date.getMonth()]} ${date.getFullYear()}`;
    const bookingsCount = memoryDb.bookings.filter(b => b.passenger_id === userId && b.status === 'completed').length;
    const ridesCount = memoryDb.rides.filter(r => r.driver_id === userId && r.status === 'completed').length;
    return { joinedDate, tripsCount: bookingsCount + ridesCount };
  } else {
    const q = `
      SELECT 
        TO_CHAR(created_at, 'Mon YYYY') AS joined_date,
        (SELECT COUNT(*) FROM bookings WHERE passenger_id = $1 AND status = 'completed') +
        (SELECT COUNT(*) FROM rides WHERE driver_id = $1 AND status = 'completed') AS trips_count
      FROM users
      WHERE id = $1
    `;
    const res = await dbQuery(q, [userId]);
    if (res.rows.length > 0) {
      return {
        joinedDate: res.rows[0].joined_date || 'Jun 2026',
        tripsCount: parseInt(res.rows[0].trips_count || '0', 10)
      };
    }
    return { joinedDate: 'Jun 2026', tripsCount: 0 };
  }
}

// Middleware to verify JWT access token
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    (req as any).user = decoded;
    next();
  });
}

// 1. POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  // Simulated OTP SMS trigger
  return res.json(true);
});

// 2. POST /api/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  if (!otp || otp.length !== 6) return res.status(400).json({ error: 'Invalid OTP format' });

  try {
    let user: any = null;
    
    if (isFallback) {
      user = memoryDb.users.find(u => u.phone === phone);
      if (!user) {
        const suffix = phone.substring(phone.length - 4);
        user = {
          id: `usr_${Date.now()}`,
          name: `User ${suffix}`,
          email: `user.${suffix}@example.com`,
          phone: phone,
          photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${suffix}`,
          is_mobile_verified: true,
          is_email_verified: false,
          created_at: new Date(),
          rating: 5.0,
          reviews_count: 0,
          trips_count: 0
        };
        memoryDb.users.push(user);
      }
    } else {
      const result = await dbQuery('SELECT * FROM users WHERE phone = $1', [phone]);
      if (result.rows.length > 0) {
        user = result.rows[0];
      } else {
        const suffix = phone.substring(phone.length - 4);
        const newId = `usr_${Date.now()}`;
        const insertRes = await dbQuery(
          `INSERT INTO users (id, name, email, phone, photo_url, is_mobile_verified, is_email_verified, rating, reviews_count, trips_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [newId, `User ${suffix}`, `user.${suffix}@example.com`, phone, `https://api.dicebear.com/7.x/avataaars/svg?seed=user${suffix}`, true, false, 5.0, 0, 0]
        );
        user = insertRes.rows[0];
      }
    }

    let registeredVehicles: any[] = [];
    if (isFallback) {
      registeredVehicles = memoryDb.vehicles.filter(v => v.user_id === user.id);
    } else {
      const vehRes = await dbQuery('SELECT * FROM vehicles WHERE user_id = $1', [user.id]);
      registeredVehicles = vehRes.rows;
    }

    const stats = await getUserStats(user.id);
    const responseUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photoUrl: user.photo_url,
      isMobileVerified: user.is_mobile_verified,
      isEmailVerified: user.is_email_verified,
      licensePlaceholder: user.license_placeholder || user.license_number,
      createdAt: user.created_at,
      driverDetails: user.license_number ? {
        rating: Number(user.rating),
        reviewsCount: user.reviews_count,
        licenseNumber: user.license_number,
        isLicenseVerified: user.is_license_verified,
        joinedDate: stats.joinedDate,
        tripsCount: stats.tripsCount
      } : undefined,
      registeredVehicles: registeredVehicles.map(v => ({
        id: v.id,
        model: v.model,
        numberPlate: v.number_plate,
        type: v.type,
        color: v.color
      }))
    };

    const token = generateAccessToken(user.id, user.email);
    const refreshToken = await generateAndStoreRefreshToken(user.id);
    return res.json({ user: responseUser, token, refreshToken });
  } catch (err: any) {
    console.error('Verify OTP Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 3. POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const { name, email, phone, license } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone are required' });
  }

  try {
    let user: any = null;
    const newId = `usr_${Date.now()}`;
    const photoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
    const driverDetails = license ? {
      rating: 5.0,
      reviewsCount: 0,
      licenseNumber: license,
      isLicenseVerified: true,
      joinedDate: 'Today',
      tripsCount: 0
    } : undefined;

    if (isFallback) {
      const emailExists = memoryDb.users.some(u => u.email === email);
      const phoneExists = memoryDb.users.some(u => u.phone === phone);
      if (emailExists || phoneExists) {
        return res.status(400).json({ error: 'Email or phone number already registered' });
      }

      user = {
        id: newId,
        name,
        email,
        phone,
        photo_url: photoUrl,
        is_mobile_verified: true,
        is_email_verified: false,
        license_placeholder: license || null,
        created_at: new Date(),
        rating: 5.0,
        reviews_count: 0,
        license_number: license || null,
        is_license_verified: license ? true : false,
        joined_date: 'Today',
        trips_count: 0
      };
      memoryDb.users.push(user);
    } else {
      const checkRes = await dbQuery('SELECT * FROM users WHERE email = $1 OR phone = $2', [email, phone]);
      if (checkRes.rows.length > 0) {
        return res.status(400).json({ error: 'Email or phone number already registered' });
      }

      const insertRes = await dbQuery(
        `INSERT INTO users (id, name, email, phone, photo_url, is_mobile_verified, is_email_verified, license_placeholder, rating, reviews_count, license_number, is_license_verified, joined_date, trips_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [newId, name, email, phone, photoUrl, true, false, license || null, 5.0, 0, license || null, license ? true : false, 'Today', 0]
      );
      user = insertRes.rows[0];
    }

    const stats = await getUserStats(user.id);
    const responseUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photoUrl: user.photo_url,
      isMobileVerified: user.is_mobile_verified,
      isEmailVerified: user.is_email_verified,
      licensePlaceholder: user.license_placeholder || user.license_number,
      createdAt: user.created_at,
      driverDetails: user.license_number ? {
        rating: Number(user.rating) || 5.0,
        reviewsCount: Number(user.reviews_count) || 0,
        licenseNumber: user.license_number,
        isLicenseVerified: user.is_license_verified,
        joinedDate: stats.joinedDate,
        tripsCount: stats.tripsCount
      } : undefined,
      registeredVehicles: []
    };

    const token = generateAccessToken(user.id, user.email);
    const refreshToken = await generateAndStoreRefreshToken(user.id);
    return res.json({ user: responseUser, token, refreshToken });
  } catch (err: any) {
    console.error('Signup Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 4. GET /api/auth/me
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  
  try {
    let user: any = null;
    
    if (isFallback) {
      user = memoryDb.users.find(u => u.id === decoded.userId);
    } else {
      const result = await dbQuery('SELECT * FROM users WHERE id = $1', [decoded.userId]);
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    let registeredVehicles: any[] = [];
    if (isFallback) {
      registeredVehicles = memoryDb.vehicles.filter(v => v.user_id === user.id);
    } else {
      const vehRes = await dbQuery('SELECT * FROM vehicles WHERE user_id = $1', [user.id]);
      registeredVehicles = vehRes.rows;
    }

    const stats = await getUserStats(user.id);
    const responseUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photoUrl: user.photo_url,
      isMobileVerified: user.is_mobile_verified,
      isEmailVerified: user.is_email_verified,
      licensePlaceholder: user.license_placeholder || user.license_number,
      createdAt: user.created_at,
      driverDetails: user.license_number ? {
        rating: Number(user.rating),
        reviewsCount: user.reviews_count,
        licenseNumber: user.license_number,
        isLicenseVerified: user.is_license_verified,
        joinedDate: stats.joinedDate,
        tripsCount: stats.tripsCount
      } : undefined,
      registeredVehicles: registeredVehicles.map(v => ({
        id: v.id,
        model: v.model,
        numberPlate: v.number_plate,
        type: v.type,
        color: v.color
      }))
    };

    return res.json(responseUser);
  } catch (err: any) {
    console.error('Fetch Me Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 5. POST /api/auth/license
router.post('/license', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  const { licenseCode } = req.body;
  if (!licenseCode) return res.status(400).json({ error: 'License code is required' });

  try {
    let user: any = null;
    
    if (isFallback) {
      const idx = memoryDb.users.findIndex(u => u.id === decoded.userId);
      if (idx !== -1) {
        memoryDb.users[idx].license_placeholder = licenseCode;
        memoryDb.users[idx].license_number = licenseCode;
        memoryDb.users[idx].is_license_verified = true;
        user = memoryDb.users[idx];
      }
    } else {
      const updateRes = await dbQuery(
        `UPDATE users 
         SET license_placeholder = $1, license_number = $1, is_license_verified = TRUE 
         WHERE id = $2 RETURNING *`,
        [licenseCode, decoded.userId]
      );
      if (updateRes.rows.length > 0) {
        user = updateRes.rows[0];
      }
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    let registeredVehicles: any[] = [];
    if (isFallback) {
      registeredVehicles = memoryDb.vehicles.filter(v => v.user_id === user.id);
    } else {
      const vehRes = await dbQuery('SELECT * FROM vehicles WHERE user_id = $1', [user.id]);
      registeredVehicles = vehRes.rows;
    }

    const stats = await getUserStats(user.id);
    const responseUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photoUrl: user.photo_url,
      isMobileVerified: user.is_mobile_verified,
      isEmailVerified: user.is_email_verified,
      licensePlaceholder: user.license_placeholder || user.license_number,
      createdAt: user.created_at,
      driverDetails: {
        rating: Number(user.rating),
        reviewsCount: user.reviews_count,
        licenseNumber: user.license_number,
        isLicenseVerified: user.is_license_verified,
        joinedDate: stats.joinedDate,
        tripsCount: stats.tripsCount
      },
      registeredVehicles: registeredVehicles.map(v => ({
        id: v.id,
        model: v.model,
        numberPlate: v.number_plate,
        type: v.type,
        color: v.color
      }))
    };

    return res.json(responseUser);
  } catch (err: any) {
    console.error('License Update Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 6. POST /api/auth/demo-login
router.post('/demo-login', async (req: Request, res: Response) => {
  const { role } = req.body;
  
  try {
    let user: any = null;
    
    if (isFallback) {
      if (role === 'passenger') {
        user = memoryDb.users.find(u => u.id === 'usr_me');
      } else {
        user = memoryDb.users.find(u => u.name === 'Amit Sharma');
      }
    } else {
      let queryText = 'SELECT * FROM users WHERE id = $1';
      let param = 'usr_me';
      if (role !== 'passenger') {
        queryText = 'SELECT * FROM users WHERE name = $1 LIMIT 1';
        param = 'Amit Sharma';
      }
      const result = await dbQuery(queryText, [param]);
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found. Ensure seeding ran.' });
    }

    let registeredVehicles: any[] = [];
    if (isFallback) {
      registeredVehicles = memoryDb.vehicles.filter(v => v.user_id === user.id);
    } else {
      const vehRes = await dbQuery('SELECT * FROM vehicles WHERE user_id = $1', [user.id]);
      registeredVehicles = vehRes.rows;
    }

    const stats = await getUserStats(user.id);
    const responseUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photoUrl: user.photo_url,
      isMobileVerified: user.is_mobile_verified,
      isEmailVerified: user.is_email_verified,
      licensePlaceholder: user.license_placeholder || user.license_number,
      createdAt: user.created_at,
      driverDetails: user.license_number ? {
        rating: Number(user.rating),
        reviewsCount: user.reviews_count,
        licenseNumber: user.license_number,
        isLicenseVerified: user.is_license_verified,
        joinedDate: stats.joinedDate,
        tripsCount: stats.tripsCount
      } : undefined,
      registeredVehicles: registeredVehicles.map(v => ({
        id: v.id,
        model: v.model,
        numberPlate: v.number_plate,
        type: v.type,
        color: v.color
      }))
    };

    const token = generateAccessToken(user.id, user.email);
    const refreshToken = await generateAndStoreRefreshToken(user.id);
    return res.json({ user: responseUser, token, refreshToken });
  } catch (err: any) {
    console.error('Demo Login Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 7. POST /api/auth/refresh (Access Token rotation)
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    let storedToken: any = null;
    if (isFallback) {
      storedToken = (memoryDb as any).refreshTokens?.find((t: any) => t.token === refreshToken);
    } else {
      const result = await dbQuery('SELECT * FROM refresh_tokens WHERE token = $1', [refreshToken]);
      if (result.rows.length > 0) storedToken = result.rows[0];
    }

    if (!storedToken || new Date(storedToken.expires_at || storedToken.expires_at) < new Date()) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    let user: any = null;
    if (isFallback) {
      user = memoryDb.users.find(u => u.id === storedToken.user_id);
    } else {
      const uRes = await dbQuery('SELECT * FROM users WHERE id = $1', [storedToken.user_id]);
      user = uRes.rows[0];
    }

    if (!user) return res.status(403).json({ error: 'User not found' });

    const newAccessToken = generateAccessToken(user.id, user.email);
    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error('Token Refresh Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 8. POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    try {
      if (isFallback) {
        if ((memoryDb as any).refreshTokens) {
          (memoryDb as any).refreshTokens = (memoryDb as any).refreshTokens.filter((t: any) => t.token !== refreshToken);
        }
      } else {
        await dbQuery('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      }
    } catch (err) {
      console.error('Logout Token Deletion Error:', err);
    }
  }
  return res.json(true);
});

export default router;
