const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'admin123';

/**
 * Seeds or updates the master Admin account in the database.
 * Safe to call on server startup or standalone via CLI.
 */
async function seedAdmin() {
  try {
    let shouldDisconnect = false;
    if (mongoose.connection.readyState !== 1) {
      const uri =
        process.env.MONGO_URI ||
        process.env.MONGODB_URI ||
        'mongodb://localhost:27017/hiremind';
      await mongoose.connect(uri);
      shouldDisconnect = true;
      console.log('[SeedAdmin] Connected to MongoDB for admin initialization.');
    }

    const normalizedEmail = ADMIN_EMAIL.toLowerCase().trim();
    let adminUser = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!adminUser) {
      console.log(`[SeedAdmin] Creating new admin account for ${normalizedEmail}...`);
      adminUser = new User({
        firstName: 'Admin',
        lastName: 'HireMind',
        email: normalizedEmail,
        password: ADMIN_PASSWORD,
        role: 'admin',
        isVerified: true,
        isProfileSetupCompleted: true,
        tier: 'ENTERPRISE',
      });
      await adminUser.save();
      console.log(`[SeedAdmin] Successfully created admin account (${normalizedEmail}).`);
    } else {
      console.log(`[SeedAdmin] Existing account found for ${normalizedEmail}. Ensuring admin credentials & role...`);
      adminUser.role = 'admin';
      adminUser.isVerified = true;
      adminUser.isProfileSetupCompleted = true;
      adminUser.password = ADMIN_PASSWORD; // Will be hashed via pre('save') hook
      await adminUser.save();
      console.log(`[SeedAdmin] Successfully updated admin account (${normalizedEmail}) with role 'admin' and active password.`);
    }

    if (shouldDisconnect) {
      await mongoose.disconnect();
      console.log('[SeedAdmin] Disconnected from MongoDB.');
    }

    return adminUser;
  } catch (error) {
    console.error('[SeedAdmin Error]:', error);
    throw error;
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
