const express = require('express');
const router = express.Router();
const Class = require('../models/Class');

// IST = UTC+5:30 — arithmetic avoids relying on Intl timezone support in Node
function todayIST() {
  const now = new Date();
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  return new Date(istMs).toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

// ─── GET /api/classes ─────────────────────────────────────────────────────────
// Returns all class documents sorted by ageGroup, with student count and today's lock status
router.get('/', async (req, res) => {
  try {
    const classes = await Class.find().sort({ ageGroup: 1 });
    const Student = require('../models/Student');
    const today = todayIST();
    
    // Enrich with student count and lock status
    const enriched = await Promise.all(classes.map(async (c) => {
      const studentCount = await Student.countDocuments({ classId: c._id });
      const isLockedToday = c.attendanceLocked && c.attendanceLocked.includes(today);
      return { ...c.toObject(), studentCount, isLockedToday };
    }));
    
    res.status(200).json({ success: true, count: enriched.length, data: enriched });
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
// No auth required: teachers submit lock after bulk attendance
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

const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

// ─── POST /api/classes/:id/bulk-attendance ────────────────────────────────────
// Body: { date: 'YYYY-MM-DD', loggedBy: 'Teacher Name', attendanceData: [{ studentId, status }] }
// No auth required: attendance is not security-sensitive; loggedBy is recorded for accountability
router.post('/:id/bulk-attendance', async (req, res) => {
  try {
    const { date, loggedBy, attendanceData } = req.body;
    if (!date || !attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({ success: false, message: 'Invalid payload.' });
    }

    const Student = require('../models/Student');
    let updatedCount = 0;

    // Process each student
    for (const record of attendanceData) {
      const { studentId, status } = record;
      
      // Check if already marked
      const existingLog = await Student.findOne({
        _id: studentId,
        'attendanceLogs.date': date
      });

      if (!existingLog) {
        const pointsAwarded = status === 'Present' ? 10 : status === 'Late' ? 5 : 0;
        await Student.findByIdAndUpdate(
          studentId,
          {
            $push: { attendanceLogs: { date, status, pointsAwarded, timestamp: new Date(), loggedBy } },
            $inc: { points: pointsAwarded },
          }
        );
        updatedCount++;
      }
    }

    res.status(200).json({ success: true, message: `Bulk attendance processed. ${updatedCount} students updated.` });
  } catch (err) {
    console.error('Error in bulk attendance:', err.message);
    res.status(500).json({ success: false, message: 'Server error processing bulk attendance.' });
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

// ─── POST /api/classes/:id/reset-attendance ───────────────────────────────────
// SuperAdmin only: removes ALL attendance logs for the given date from every
// student in this class AND unlocks attendance so teachers can re-submit.
// Body: { date: 'YYYY-MM-DD' }
router.post('/:id/reset-attendance', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date is required.' });
    }

    const Student = require('../models/Student');

    // Find all students in this class that have a log for this date
    const students = await Student.find({
      classId: req.params.id,
      'attendanceLogs.date': date
    });

    let resetCount = 0;
    for (const student of students) {
      const log = student.attendanceLogs.find(l => l.date === date);
      if (log) {
        const pts = log.pointsAwarded || 0;
        await Student.findByIdAndUpdate(student._id, {
          $pull: { attendanceLogs: { date } },
          $inc:  { points: -pts },
        });
        resetCount++;
      }
    }

    // Unlock attendance for this class on this date
    await Class.findByIdAndUpdate(req.params.id, {
      $pull: { attendanceLocked: date }
    });

    res.status(200).json({
      success: true,
      message: `Attendance reset for ${date}. ${resetCount} student records cleared. Class unlocked.`,
      resetCount,
    });
  } catch (err) {
    console.error('Error resetting attendance:', err.message);
    res.status(500).json({ success: false, message: 'Server error resetting attendance.' });
  }
});

// ─── DELETE /api/classes/:id ──────────────────────────────────────────────────
// SuperAdmin only: deletes a class and unassigns all students in it
router.delete('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) return res.status(404).json({ success: false, message: 'Class not found.' });

    const Student = require('../models/Student');
    // Unassign all students that belonged to this class
    const unassignResult = await Student.updateMany({ classId: req.params.id }, { $unset: { classId: '' } });

    await Class.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      message: `Class "${classDoc.className}" deleted. ${unassignResult.modifiedCount} student(s) unassigned.`,
    });
  } catch (err) {
    console.error('Error deleting class:', err.message);
    res.status(500).json({ success: false, message: 'Server error deleting class.' });
  }
});


module.exports = router;

