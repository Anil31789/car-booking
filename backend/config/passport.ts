import 'dotenv/config';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { dbQuery, isFallback, memoryDb } from '../db.js';

// Setup Google Strategy using environment variables
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_id',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret',
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
},
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase().trim() : '';
      if (!email) {
        return done(new Error('No email found in Google profile'));
      }

      const googleId = profile.id;
      const name = profile.displayName || 'Google User';
      const photoUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

      let user: any = null;

      if (isFallback) {
        user = memoryDb.users.find(u => u.google_id === googleId || u.email === email);
        if (user) {
          // Link account automatically if exists, update google_id if missing, mark email_verified = true
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
          if (!user.google_id || !user.email_verified) {
            await dbQuery(
              'UPDATE users SET google_id = $1, email_verified = TRUE, is_email_verified = TRUE WHERE id = $2',
              [googleId, user.id]
            );
            user.google_id = googleId;
            user.email_verified = true;
            user.is_email_verified = true;
          }
        } else {
          const newId = `usr_${Date.now()}`;
          const insertRes = await dbQuery(
            `INSERT INTO users (id, name, email, phone, photo_url, is_mobile_verified, is_email_verified, email_verified, password_hash, google_id, auth_provider, rating, reviews_count, license_number, is_license_verified, joined_date, trips_count)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
            [newId, name, email, null, photoUrl, false, true, true, null, googleId, 'google', 5.0, 0, null, false, 'Today', 0]
          );
          user = insertRes.rows[0];
        }
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;
