// config/passport-setup.js
require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const { Pool } = require('pg');

// Create a new PostgreSQL pool using environment variables
const pool = new Pool({
  user: process.env.DB_USER,           // Database username
  host: process.env.DB_HOST,           // Database host
  database: process.env.DB_DATABASE,   // Database name
  password: process.env.DB_PASSWORD,   // Database password
  port: process.env.DB_PORT,           // Database port (usually 5432)
});

// Serialize user into the sessions
passport.serializeUser((user, done) => {
  done(null, user.id); // Save the user's id to the session
});

// Deserialize user from the sessions
passport.deserializeUser((id, done) => {
  pool
    .query('SELECT * FROM users WHERE id = $1', [id])
    .then((result) => {
      done(null, result.rows[0]); // Pass the user object to req.user
    })
    .catch((err) => {
      done(err);
    });
});

// Configure Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,       // Set in .env file
      clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Set in .env file
      callbackURL: '/auth/google/callback',         // Redirect URI after authentication
    },
    async (accessToken, refreshToken, profile, done) => {
      const googleId = profile.id;
      const displayName = profile.displayName;
      const email = profile.emails[0].value;
      const photo = profile.photos[0].value;

      try {
        // Check if the user already exists in the database
        const res = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
        let user = res.rows[0];

        if (!user) {
          // If user doesn't exist, create a new user
          const insertRes = await pool.query(
            'INSERT INTO users (google_id, display_name, email, photo) VALUES ($1, $2, $3, $4) RETURNING *',
            [googleId, displayName, email, photo]
          );
          user = insertRes.rows[0];
        }

        // Pass the user object to the next middleware
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

// Configure Facebook Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,         // Set in .env file
      clientSecret: process.env.FACEBOOK_APP_SECRET, // Set in .env file
      callbackURL: '/auth/facebook/callback',        // Redirect URI after authentication
      profileFields: ['id', 'displayName', 'email', 'photos'], // Fields to retrieve from Facebook
    },
    async (accessToken, refreshToken, profile, done) => {
      const facebookId = profile.id;
      const displayName = profile.displayName;
      const email = profile.emails ? profile.emails[0].value : null;
      const photo = profile.photos ? profile.photos[0].value : null;

      try {
        // Check if the user already exists in the database
        const res = await pool.query('SELECT * FROM users WHERE facebook_id = $1', [facebookId]);
        let user = res.rows[0];

        if (!user) {
          // If user doesn't exist, create a new user
          const insertRes = await pool.query(
            'INSERT INTO users (facebook_id, display_name, email, photo) VALUES ($1, $2, $3, $4) RETURNING *',
            [facebookId, displayName, email, photo]
          );
          user = insertRes.rows[0];
        }

        // Pass the user object to the next middleware
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);