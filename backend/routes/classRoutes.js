const express = require('express');
const router = express.Router();
const Class = require('../models/Class');

// ─── GET /api/classes ─────────────────────────────────────────────────────────
// Returns all class documents sorted by ageGroup
router.get('/', async (req, res) => {
  try {
    const classes = await Class.find().sort({ ageGroup: 1 });
    res.status(200).json({ success: true, count: classes.length, data: classes });
  } catch (err) {
    console.error('Error fetching classes — full:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error fetching classes.' });
  }
});

// ─── POST /api/classes ────────────────────────────────────────────────────────
// Body: { className, ageGroup }
router.post('/', async (req, res) => {
  try {
    const { className, ageGroup } = req.body;
    if (!className || !ageGroup) {
      return res.status(400).json({ success: false, message: 'className and ageGroup are required.' });
    }
    const newClass = await Class.create({ className, ageGroup });
    res.status(201).json({ success: true, data: newClass });
  } catch (err) {
    console.error('Error creating class:', err.message);
    res.status(500).json({ success: false, message: 'Server error creating class.' });
  }
});

// ─── POST /api/classes/:id/lock-attendance ────────────────────────────────────
// Body: { date: 'YYYY-MM-DD' }
// Adds the date to attendanceLocked array (idempotent — won't duplicate)
router.post('/:id/lock-attendance', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date is required.' });
    }

    const classDoc = await Class.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { attendanceLocked: date } }, // addToSet prevents duplicates
      { new: true }
    );

    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    res.status(200).json({
      success: true,
      message: `Attendance locked for ${date}.`,
      data: classDoc,
    });
  } catch (err) {
    console.error('Error locking attendance:', err.message);
    res.status(500).json({ success: false, message: 'Server error locking attendance.' });
  }
});

// ─── GET /api/classes/:id/attendance-locked/:date ─────────────────────────────
// Returns { locked: true/false } for whether that date is already locked
router.get('/:id/attendance-locked/:date', async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    const locked = classDoc.attendanceLocked.includes(req.params.date);
    res.status(200).json({ success: true, locked });
  } catch (err) {
    console.error('Error checking lock:', err.message);
    res.status(500).json({ success: false, message: 'Server error checking lock.' });
  }
});

module.exports = router;
