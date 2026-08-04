import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { dbQuery, isFallback, memoryDb } from '../db.js';
import { emailProvider } from '../services/email.service.js';

const router = Router();
const JWT_SECRET = process.env.NODE_ENV === 'production' 
  ? process.env.JWT_SECRET! 
  : (process.env.JWT_SECRET || 'highwaypool_supersecret_jwt_token_key_2026');

if (process.env.NODE_ENV === 'production' && (!JWT_SECRET || JWT_SECRET === 'highwaypool_supersecret_jwt_token_key_2026')) {
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be configured and cannot use the default dev key in production.');
}

const googleClient = new OAuth2Client();

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

// 1. POST /api/auth/register (Email + Password sign up)
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  try {
    const formattedEmail = email.toLowerCase().trim();
    
    // Check duplicate
    if (isFallback) {
      const exists = memoryDb.users.some(u => u.email === formattedEmail);
      if (exists) return res.status(400).json({ error: 'Email already registered' });
    } else {
      const check = await dbQuery('SELECT id FROM users WHERE email = $1', [formattedEmail]);
      if (check.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date();
    verificationExpiry.setHours(verificationExpiry.getHours() + 24); // 24 hours

    const newId = `usr_${Date.now()}`;
    const photoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

    const newUser = {
      id: newId,
      name,
      email: formattedEmail,
      phone: phone || null,
      photo_url: photoUrl,
      is_mobile_verified: phone ? true : false,
      is_email_verified: false,
      email_verified: false,
      password_hash: passwordHash,
      google_id: null,
      auth_provider: 'local',
      email_verification_token: verificationToken,
      email_verification_expiry: verificationExpiry,
      rating: 5.0,
      reviews_count: 0,
      license_placeholder: null,
      license_number: null,
      is_license_verified: false,
      joined_date: 'Today',
      trips_count: 0
    };

    if (isFallback) {
      memoryDb.users.push(newUser);
    } else {
      await dbQuery(
        `INSERT INTO users (id, name, email, phone, photo_url, is_mobile_verified, is_email_verified, email_verified, password_hash, auth_provider, email_verification_token, email_verification_expiry, rating, reviews_count, license_number, is_license_verified, joined_date, trips_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          newId, name, formattedEmail, phone || null, photoUrl, phone ? true : false, false, false,
          passwordHash, 'local', verificationToken, verificationExpiry, 5.0, 0, null, false, 'Today', 0
        ]
      );
    }

    // Send email
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:4200';
    const verifyLink = `${frontendBaseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(formattedEmail)}`;
    const mailContent = `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0a84ff; margin-bottom: 16px;">Verify your Email</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering at HighwayPool. Please click the button below to verify your email address and activate your account:</p>
        <div style="margin: 24px 0;">
          <a href="${verifyLink}" style="display: inline-block; background-color: #0a84ff; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
        </div>
        <p style="color: #64748b; font-size: 0.88rem;">If the button doesn't work, copy and paste the raw link below into your browser:</p>
        <p style="word-break: break-all; color: #0a84ff; font-size: 0.82rem;"><a href="${verifyLink}">${verifyLink}</a></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #64748b; font-size: 0.78rem;">This verification link will expire in 24 hours.</p>
      </div>
    `;
    await emailProvider.sendMail(formattedEmail, 'Verify your HighwayPool Account', mailContent);

    return res.json({ success: true, message: 'Registration successful. Please verify your email.' });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 2. GET /api/auth/verify-email (Verify registration callback)
router.get('/verify-email', async (req: Request, res: Response) => {
  const { token, email } = req.query;
  console.log(`[Email Verification] Received verification request. Token: ${token}, Email: ${email}`);

  if (!token) return res.status(400).json({ error: 'Verification token is missing.' });

  try {
    let user: any = null;

    if (email) {
      const formattedEmail = (email as string).toLowerCase().trim();
      if (isFallback) {
        user = memoryDb.users.find(u => u.email === formattedEmail);
      } else {
        const result = await dbQuery('SELECT * FROM users WHERE email = $1', [formattedEmail]);
        if (result.rows.length > 0) {
          user = result.rows[0];
        }
      }
    }

    // Fallback search by token if email wasn't provided (for backward compatibility)
    if (!user) {
      if (isFallback) {
        user = memoryDb.users.find(u => u.email_verification_token === token);
      } else {
        const result = await dbQuery('SELECT * FROM users WHERE email_verification_token = $1', [token]);
        if (result.rows.length > 0) {
          user = result.rows[0];
        }
      }
    }

    if (!user) {
      console.warn(`[Email Verification] Token search failed. User not found for token: ${token}, email: ${email}`);
      return res.status(400).json({ error: 'Invalid verification link. The email may have already been verified, or the link is incorrect.' });
    }

    // Check if already verified
    if (user.email_verified || user.is_email_verified) {
      console.log(`[Email Verification] Email is already verified for user: ${user.email}`);
      return res.json({ success: true, message: 'Email is already verified.' });
    }

    // Validate token matches and has not expired
    if (user.email_verification_token !== token) {
      console.warn(`[Email Verification] Token mismatch for user ${user.email}. Expected: ${user.email_verification_token}, Received: ${token}`);
      return res.status(400).json({ error: 'Invalid verification link.' });
    }

    if (new Date(user.email_verification_expiry) < new Date()) {
      console.warn(`[Email Verification] Token expired for user ${user.email}. Expiry: ${user.email_verification_expiry}`);
      return res.status(400).json({ error: 'Verification link expired.' });
    }

    // Perform verification update
    if (isFallback) {
      user.email_verified = true;
      user.is_email_verified = true;
      user.email_verification_token = null;
    } else {
      await dbQuery(
        "UPDATE users SET email_verified = TRUE, is_email_verified = TRUE, email_verification_token = NULL WHERE id = $1",
        [user.id]
      );
    }

    console.log(`[Email Verification] Successfully verified email for user: ${user.email}`);
    return res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    console.error('[Email Verification] Error executing verification:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 3. POST /api/auth/login (Email + Password authentication)
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const formattedEmail = email.toLowerCase().trim();
    let user: any = null;

    if (isFallback) {
      user = memoryDb.users.find(u => u.email === formattedEmail);
    } else {
      const result = await dbQuery('SELECT * FROM users WHERE email = $1', [formattedEmail]);
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.auth_provider === 'google' && !user.password_hash) {
      return res.status(400).json({ error: 'This account uses Google Sign-In. Please set a password or use Google to log in.' });
    }

    if (!user.email_verified) {
      return res.status(400).json({ error: 'Please verify your email address before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
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
        rating: Number(user.rating) || 5.0,
        reviewsCount: Number(user.reviews_count) || 0,
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
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 4. POST /api/auth/google (Google OAuth 2.0 validation)
router.post('/google', async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'Google ID token is required' });

  try {
    let payload: any;
    
    if (process.env.NODE_ENV === 'test' || isFallback) {
      // Decode JWT locally for mock testing or local dev fallback when CLIENT_ID is offline
      const parts = idToken.split('.');
      if (parts.length === 3) {
        payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      } else {
        payload = { sub: 'mock_google_id_123', email: 'mock@google.com', name: 'Google Mock User' };
      }
    } else {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid ID token content' });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();
    const name = payload.name || 'Google User';
    const photoUrl = payload.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

    let user: any = null;

    if (isFallback) {
      user = memoryDb.users.find(u => u.google_id === googleId || u.email === email);
      if (user) {
        user.google_id = googleId;
        user.email_verified = true;
        user.is_email_verified = true;
      } else {
        user = {
          id: `usr_${Date.now()}`,
          name,
          email,
          phone: null,
          photo_url: photoUrl,
          is_mobile_verified: false,
          is_email_verified: true,
          email_verified: true,
          password_hash: null,
          google_id: googleId,
          auth_provider: 'google',
          rating: 5.0,
          reviews_count: 0,
          license_number: null,
          is_license_verified: false,
          joined_date: 'Today',
          trips_count: 0
        };
        memoryDb.users.push(user);
      }
    } else {
      const checkRes = await dbQuery('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);
      if (checkRes.rows.length > 0) {
        user = checkRes.rows[0];
        if (!user.google_id) {
          await dbQuery('UPDATE users SET google_id = $1, email_verified = TRUE, is_email_verified = TRUE WHERE id = $2', [googleId, user.id]);
          user.google_id = googleId;
          user.email_verified = true;
        }
      } else {
        const newId = `usr_${Date.now()}`;
        const insertRes = await dbQuery(
          `INSERT INTO users (id, name, email, phone, photo_url, is_mobile_verified, is_email_verified, email_verified, password_hash, google_id, auth_provider, rating, reviews_count, license_number, is_license_verified, joined_date, trips_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
          [newId, name, email, null, photoUrl, false, true, true, null, googleId, 'google', 5.0, 0, null, false, 'Today', 0]
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
        rating: Number(user.rating) || 5.0,
        reviewsCount: Number(user.reviews_count) || 0,
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
  } catch (err) {
    console.error('Google Auth Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 5. POST /api/auth/set-password (Configure password for Google Sign-In users)
router.post('/set-password', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  const { password } = req.body;
  
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    
    if (isFallback) {
      const user = memoryDb.users.find(u => u.id === decoded.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      user.password_hash = passwordHash;
    } else {
      const result = await dbQuery('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, decoded.userId]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, message: 'Password configured successfully.' });
  } catch (err) {
    console.error('Set Password Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 6. POST /api/auth/forgot-password (Forgot password trigger)
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address is required' });

  try {
    const formattedEmail = email.toLowerCase().trim();
    let user: any = null;

    if (isFallback) {
      user = memoryDb.users.find(u => u.email === formattedEmail);
    } else {
      const result = await dbQuery('SELECT * FROM users WHERE email = $1', [formattedEmail]);
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    }

    if (!user) {
      return res.json({ success: true, message: 'If the email exists, a reset link will be sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date();
    resetExpiry.setMinutes(resetExpiry.getMinutes() + 30); // 30 minutes

    if (isFallback) {
      user.password_reset_token = resetToken;
      user.password_reset_expiry = resetExpiry;
    } else {
      await dbQuery(
        'UPDATE users SET password_reset_token = $1, password_reset_expiry = $2 WHERE id = $3',
        [resetToken, resetExpiry, user.id]
      );
    }

    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:4200';
    const resetLink = `${frontendBaseUrl}/reset-password?token=${resetToken}`;
    const mailContent = `
      <h2>Reset your Password</h2>
      <p>Hello ${user.name},</p>
      <p>You requested a password reset. Please click the link below to configure a new password:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>This password reset link will expire in 30 minutes.</p>
    `;
    await emailProvider.sendMail(formattedEmail, 'Reset your HighwayPool Password', mailContent);

    return res.json({ success: true, message: 'Password recovery email sent.' });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 7. POST /api/auth/reset-password (Reset password handler)
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  const hasLetter = /[a-zA-Z]/.test(newPassword || '');
  const hasNumber = /[0-9]/.test(newPassword || '');

  if (!token || !newPassword || newPassword.length < 8 || !hasLetter || !hasNumber) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain both letters and numbers.' });
  }

  try {
    let user: any = null;

    if (isFallback) {
      user = memoryDb.users.find(u => u.password_reset_token === token);
      if (user) {
        if (new Date(user.password_reset_expiry) < new Date()) {
          return res.status(400).json({ error: 'Reset token has expired.' });
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        user.password_hash = passwordHash;
        user.password_reset_token = null;
      }
    } else {
      const result = await dbQuery('SELECT * FROM users WHERE password_reset_token = $1', [token]);
      if (result.rows.length > 0) {
        user = result.rows[0];
        if (new Date(user.password_reset_expiry) < new Date()) {
          return res.status(400).json({ error: 'Reset token has expired.' });
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await dbQuery(
          'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expiry = NULL WHERE id = $2',
          [passwordHash, user.id]
        );
      }
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    return res.json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 8. GET /api/auth/me
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
        rating: Number(user.rating) || 5.0,
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

// 9. POST /api/auth/license
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
        rating: Number(user.rating) || 5.0,
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

// 10. POST /api/auth/demo-login
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
        rating: Number(user.rating) || 5.0,
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

// 11. POST /api/auth/refresh
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

    if (!storedToken || new Date(storedToken.expires_at) < new Date()) {
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

// 12. POST /api/auth/logout
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
