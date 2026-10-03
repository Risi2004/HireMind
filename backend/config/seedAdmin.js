const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const LEGACY_DEFAULT_PASSWORD = 'admin123';

/**
 * Seeds the master Admin account from environment variables.
 *
 *   ADMIN_EMAIL     (default: admin@gmail.com)
 *   ADMIN_PASSWORD  (required in production; local dev falls back to admin123)
 *
 * Behaviour:
 * - Creates the admin account if it does not exist.
 * - If ADMIN_PASSWORD is set and differs from the stored password, the stored password
 *   is rotated to ADMIN_PASSWORD (this is how you change the admin password).
 * - Never silently resets the password to a hardcoded value.
 * - In production, an admin still using the publicly known legacy password "admin123"
 *   is locked with a random password until ADMIN_PASSWORD is configured.
 *
 * Safe to call on server startup or standalone via CLI.
 */
async function seedAdmin() {
  const isProduction = process.env.NODE_ENV === 'production';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase().trim();
  const envPassword = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD) : '';

  let shouldDisconnect = false;
  try {
    if (mongoose.connection.readyState !== 1) {
      const uri =
        process.env.MONGO_URI ||
        process.env.MONGODB_URI ||
        'mongodb://localhost:27017/hiremind';
      await mongoose.connect(uri);
      shouldDisconnect = true;
      console.log('[SeedAdmin] Connected to MongoDB for admin initialization.');
    }

    if (envPassword && envPassword.length < 12) {
      console.warn('[SeedAdmin] WARNING: ADMIN_PASSWORD should be at least 12 characters long.');
    }

    let adminUser = await User.findOne({ email: adminEmail }).select('+password');

    if (!adminUser) {
      if (isProduction && !envPassword) {
        console.error(
          '[SeedAdmin] ADMIN_PASSWORD is not set — skipping admin creation in production. ' +
            'Set ADMIN_EMAIL and ADMIN_PASSWORD in the backend environment and restart.'
        );
        return null;
      }

      adminUser = new User({
        firstName: 'Admin',
        lastName: 'HireMind',
        email: adminEmail,
        password: envPassword || LEGACY_DEFAULT_PASSWORD,
        role: 'admin',
        isVerified: true,
        isProfileSetupCompleted: true,
        tier: 'ENTERPRISE',
      });
      await adminUser.save();
      console.log(`[SeedAdmin] Created admin account (${adminEmail}).`);
      return adminUser;
    }

    let changed = false;
    if (adminUser.role !== 'admin') {
      adminUser.role = 'admin';
      changed = true;
    }
    if (!adminUser.isVerified || !adminUser.isProfileSetupCompleted) {
      adminUser.isVerified = true;
      adminUser.isProfileSetupCompleted = true;
      changed = true;
    }

    if (envPassword) {
      // Rotate to the configured password only when it actually differs
      const matches = await adminUser.comparePassword(envPassword);
      if (!matches) {
        adminUser.password = envPassword; // hashed by pre('save')
        changed = true;
        console.log(`[SeedAdmin] Admin password updated from ADMIN_PASSWORD for ${adminEmail}.`);
      }
    } else if (isProduction && (await adminUser.comparePassword(LEGACY_DEFAULT_PASSWORD))) {
      // The legacy hardcoded password is public (it was in source control) — lock it.
      adminUser.password = crypto.randomBytes(32).toString('hex');
      changed = true;
      console.error(
        '[SeedAdmin] SECURITY: The admin account was using the default password and has been locked. ' +
          'Set ADMIN_PASSWORD in the backend environment and restart to sign in as admin.'
      );
    }

    if (changed) {
      await adminUser.save();
    }

    return adminUser;
  } catch (error) {
    console.error('[SeedAdmin Error]:', error);
    throw error;
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect();
      console.log('[SeedAdmin] Disconnected from MongoDB.');
    }
  }
}

// Allow direct execution from CLI: `node config/seedAdmin.js`
if (require.main === module) {
  seedAdmin()
    .then(() => {
      console.log('[SeedAdmin] Admin seeding process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SeedAdmin Failed]:', err);
      process.exit(1);
    });
}

module.exports = seedAdmin;
