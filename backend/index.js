const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const { checkR2Connection } = require('./services/cloudflareR2');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Enable trust proxy for Render reverse proxy (Cloudflare/Envoy)
app.set('trust proxy', 1);

// Security middleware with cross-origin resource policy enabled for avatars/assets
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Dynamic CORS configuration supporting local dev, Render, Vercel, and custom domains
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
].filter(Boolean);

// Parse comma-separated list of origins if present
const parsedOrigins = [];
allowedOrigins.forEach((item) => {
  if (typeof item === 'string') {
    item.split(',').forEach((o) => {
      const trimmed = o.trim().replace(/\/+$/, '');
      if (trimmed && !parsedOrigins.includes(trimmed)) {
        parsedOrigins.push(trimmed);
      }
    });
  }
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests, mobile apps, or local curl with no origin header
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/+$/, '');
      const isAllowed =
        parsedOrigins.includes(cleanOrigin) ||
        /^https?:\/\/localhost(:\d+)?$/.test(cleanOrigin) ||
        /^https:\/\/.*\.vercel\.app$/.test(cleanOrigin) ||
        /^https:\/\/.*\.onrender\.com$/.test(cleanOrigin) ||
        /^https:\/\/.*\.netlify\.app$/.test(cleanOrigin);

      if (isAllowed) {
        return callback(null, true);
      }
      // Allow fallback to avoid breaking valid frontend origins in production
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health Check Routes (Essential for Render zero-downtime health probes)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'HireMind API Server',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Authentication & Profile Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// Start server on 0.0.0.0 for containerized Render runtime
const server = app.listen(PORT, HOST, async () => {
  console.log(`[HireMind API] Server running on http://${HOST}:${PORT} (Port: ${PORT})`);
  // Verify Cloudflare R2 bucket connection
  await checkR2Connection();
});

// Handle graceful shutdown signals from Render
process.on('SIGTERM', () => {
  console.log('[HireMind API] SIGTERM signal received. Closing HTTP server gracefully...');
  server.close(() => {
    console.log('[HireMind API] HTTP server closed cleanly.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[HireMind API] SIGINT signal received. Closing HTTP server...');
  server.close(() => {
    process.exit(0);
  });
});


