import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { Request } from 'express';

const JWT_SECRET = process.env.NODE_ENV === 'production'
  ? process.env.JWT_SECRET!
  : (process.env.JWT_SECRET || 'highwaypool_supersecret_jwt_token_key_2026');

export const generateGeneralKey = (req: Request): string => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && (decoded.userId || decoded.id)) {
        return `user_${decoded.userId || decoded.id}`;
      }
    } catch (e) {
      // Ignore
    }
  }
  return `ip_${req.ip}`;
};

export const generateSensitiveKey = (req: Request): string => {
  if ((req as any).user && ((req as any).user.userId || (req as any).user.id)) {
    return `sensitive_user_${(req as any).user.userId || (req as any).user.id}`;
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && (decoded.userId || decoded.id)) {
        return `sensitive_user_${decoded.userId || decoded.id}`;
      }
    } catch (e) {
      // Ignore
    }
  }
  return `sensitive_ip_${req.ip}`;
};

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: generateGeneralKey,
  message: { error: 'Too many requests, please try again after 15 minutes.' }
});

export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: generateSensitiveKey,
  message: { error: 'Too many sensitive requests, please try again after 15 minutes.' }
});
