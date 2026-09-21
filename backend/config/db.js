const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hiremind');
    console.log(`[HireMind DB] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[HireMind DB] Connection Error: ${error.message}`);
    // Do not crash in local development if mongo is not running locally; allow graceful reconnection
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
