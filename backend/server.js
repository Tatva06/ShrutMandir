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

// ─── Middleware ───────────────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://shrut-mandir.vercel.app',
  process.env.SUPERADMIN_URL,
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

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'ShrutMandir API is running 🎵' });
});

app.use('/api/students', studentRoutes);
app.use('/api/classes',  classRoutes);
app.use('/api/auth',     authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/settings', settingsRoutes);

// ─── MongoDB Connection (Serverless Cached) ───────────────────────────────────
const PORT = process.env.PORT || 5000;

let cachedDb = global.mongoose;

if (!cachedDb) {
  cachedDb = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cachedDb.conn) {
    return cachedDb.conn;
  }
  
  if (!cachedDb.promise) {
    cachedDb.promise = mongoose.connect(process.env.MONGO_URI).then((mongoose) => {
      console.log('✅ Connected to MongoDB (New Connection)');
      return mongoose;
    }).catch(err => {
      console.error('❌ MongoDB connection failed:', err.message);
      throw err;
    });
  }
  
  cachedDb.conn = await cachedDb.promise;
  return cachedDb.conn;
};

connectDB();

// Only listen locally, Vercel will handle the serverless function execution
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });
}

// Export the app for Vercel Serverless Functions
module.exports = app;
