const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const studentRoutes = require('./routes/studentRoutes');
const classRoutes   = require('./routes/classRoutes');
const authRoutes    = require('./routes/authRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();

// ─── MongoDB Connection (must be defined BEFORE middleware uses it) ──────────
// Uses module-level caching for Vercel serverless warm starts
let cached = { conn: null, promise: null };

const connectDB = async () => {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // fail fast after 10s
    }).then((m) => {
      console.log('✅ MongoDB connected');
      return m;
    }).catch(err => {
      cached.promise = null; // allow retry on next request
      console.error('❌ MongoDB error:', err.message);
      throw err;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
};

// Kick off connection immediately on module load
connectDB().catch(() => {});

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://shrut-mandir.vercel.app',
  'https://shrut-mandir-superadmin.vercel.app',
  'https://shrut-mandir-teacher.vercel.app',
  process.env.SUPERADMIN_URL,
  process.env.TEACHER_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// ─── DB Connection Middleware ─────────────────────────────────────────────────
// Ensures DB is ready before any route handler runs (except health/debug routes)
app.use(async (req, res, next) => {
  if (req.path === '/' || req.path === '/api/debug-db') {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Database connection failed. Please check MongoDB Atlas IP Whitelist.',
      error: err.message,
    });
  }
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'ShrutMandir API is running 🎵' });
});

app.get('/api/debug-db', (req, res) => {
  const uri = process.env.MONGO_URI || 'not set';
  const obscured = uri.replace(/:([^@]+)@/, ':***@');
  res.json({
    uri: obscured,
    readyState: mongoose.connection.readyState,
    readyStateLabel: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
  });
});

app.use('/api/students', studentRoutes);
app.use('/api/classes',  classRoutes);
app.use('/api/auth',     authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/settings', settingsRoutes);

// ─── Local dev server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });
}

// Export the app for Vercel Serverless Functions
module.exports = app;
