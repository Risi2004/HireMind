const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/hiremind';

  if (!process.env.MONGO_URI && !process.env.MONGODB_URI && process.env.NODE_ENV === 'production') {
    console.error('[HireMind DB] CRITICAL: Neither MONGO_URI nor MONGODB_URI environment variable is defined in production!');
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[HireMind DB] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[HireMind DB] Connection Error: ${error.message}`);
    // In production, exit so Render detects boot failure and alerts the user
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
