const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const { checkR2Connection } = require('./services/cloudflareR2');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & utility middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic Health Check Route
app.get('/', (req, res) => {
  res.json({ message: 'HireMind API server is running' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Authentication Routes
app.use('/api/auth', authRoutes);

app.listen(PORT, async () => {
  console.log(`[HireMind API] Server running on http://localhost:${PORT}`);
  // Verify Cloudflare R2 bucket connection
  await checkR2Connection();
});


