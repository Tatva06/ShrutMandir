const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';

// ─── POST /api/auth/setup-admin ───────────────────────────────────────────────
// Creates the very first "Genesis" SuperAdmin. Locks forever once 1 admin exists.
router.post('/setup-admin', async (req, res) => {
  try {
    // SECURITY: Genesis Admin Lock
    const adminCount = await Teacher.countDocuments({ role: 'SuperAdmin' });
    if (adminCount > 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Genesis lock active. A SuperAdmin already exists. New admins must be created from the dashboard.' 
      });
    }

    const { name, username, password } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, username, and password.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const admin = await Teacher.create({
      name,
      username,
      passwordHash,
      role: 'SuperAdmin'
    });

    res.status(201).json({ success: true, message: 'Genesis SuperAdmin created.', data: { username: admin.username } });
  } catch (err) {
    console.error('Setup Admin Error:', err);
    res.status(500).json({ success: false, message: 'Server error during setup.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username and password.' });
    }

    const teacher = await Teacher.findOne({ username: username.toLowerCase() });
    if (!teacher) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, teacher.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: teacher._id, username: teacher.username, role: teacher.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: teacher._id,
        name: teacher.name,
        username: teacher.username,
        role: teacher.role
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Returns current logged-in user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).select('-passwordHash');
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.status(200).json({ success: true, data: teacher });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
