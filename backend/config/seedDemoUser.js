const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Ensure .env is loaded from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

const DEMO_EMAIL = 'hireminddemo@gmail.com';
const DEMO_PASSWORD = 'demo@123';

async function seedDemoUser() {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/hiremind';

  console.log('[SeedDemoUser] Connecting to database...');

  try {
    await mongoose.connect(mongoUri);
    console.log('[SeedDemoUser] MongoDB connected successfully.');

    let user = await User.findOne({ email: DEMO_EMAIL }).select('+password');

    if (!user) {
      console.log(`[SeedDemoUser] Creating new user: ${DEMO_EMAIL}`);
      user = new User({
        firstName: 'HireMind',
        lastName: 'Demo',
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD, // Pre-save hook will hash this with bcrypt
        role: 'user',
        isVerified: true,
        isProfileSetupCompleted: true,
        field: 'Full Stack Development',
        careerStage: 'Mid-Level',
        experienceLevel: 'Intermediate',
        skills: ['JavaScript', 'React', 'Node.js', 'Python', 'MongoDB'],
        title: 'Full Stack Engineer',
        demoAccess: {
          enabled: true,
          allowedInterviews: 10,
          completedInterviews: 0,
          grantedAt: new Date(),
          notes: 'Pre-seeded demo user account',
        },
      });

      await user.save();
      console.log(`[SeedDemoUser] User ${DEMO_EMAIL} successfully created and pushed to DB.`);
    } else {
      console.log(`[SeedDemoUser] User ${DEMO_EMAIL} already exists. Updating credentials and status...`);
      user.password = DEMO_PASSWORD; // Pre-save hook will rehash the updated password
      user.role = 'user';
      user.isVerified = true;
      user.isProfileSetupCompleted = true;

      // Ensure demo access is enabled
      user.demoAccess = {
        enabled: true,
        allowedInterviews: Math.max(user.demoAccess?.allowedInterviews || 0, 10),
        completedInterviews: user.demoAccess?.completedInterviews || 0,
        grantedAt: user.demoAccess?.grantedAt || new Date(),
        notes: 'Pre-seeded demo user account',
      };

      await user.save();
      console.log(`[SeedDemoUser] User ${DEMO_EMAIL} successfully updated.`);
    }

    console.log('\n--- Seeded User Details ---');
    console.log('User ID:              ', user._id.toString());
    console.log('Email:                ', user.email);
    console.log('Role:                 ', user.role);
    console.log('Verified:             ', user.isVerified);
    console.log('Profile Setup Done:   ', user.isProfileSetupCompleted);
    console.log('Demo Access Enabled:  ', user.demoAccess.enabled);
    console.log('Allowed Interviews:   ', user.demoAccess.allowedInterviews);
    console.log('---------------------------\n');

  } catch (error) {
    console.error('[SeedDemoUser] Error seeding user:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[SeedDemoUser] MongoDB connection closed.');
  }
}

if (require.main === module) {
  seedDemoUser();
}

module.exports = seedDemoUser;
