const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

// ─── Helper ───────────────────────────────────────────────────────────────────
// Returns today's date as 'YYYY-MM-DD' in IST
function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ─── GET /api/students ────────────────────────────────────────────────────────
// Returns all students with backward-compatibility mapping for teacher-app
router.get('/', async (req, res) => {
  try {
    const students = await Student.find().sort({ name: 1 });

    const formatted = students.map(s => {
      const parts = (s.name || '').trim().split(/\s+/);
      return {
        _id: s._id,
        rollNo: s.rollNo,
        name: s.name,
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        phoneNumber: s.phoneNumber,
        village: s.village,
        classGroupId: { _id: s.village || 'default', name: s.village || 'No Village' },
        points: s.points,
        totalPoints: s.points,
        qrId: s.rollNo,
        attendanceLogs: s.attendanceLogs,
        activityLogs: s.activityLogs,
      };
    });

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('Error fetching students:', err.message);
    res.status(500).json({ success: false, message: 'Server error fetching students.' });
  }
});

// ─── GET /api/students/:id ────────────────────────────────────────────────────
// Returns a single student with full logs
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    console.error('Error fetching student:', err.message);
    res.status(500).json({ success: false, message: 'Server error fetching student.' });
  }
});

// ─── POST /api/students/:id/attendance ───────────────────────────────────────
// Body: { status: 'Present'|'Absent'|'Late', date: 'YYYY-MM-DD' }
// Appends to attendanceLogs and updates total points
router.post('/:id/attendance', async (req, res) => {
  try {
    const { status, date } = req.body;
    const logDate = date || todayIST();

    if (!['Present', 'Absent', 'Late'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    // Auto point awards
    const pointsAwarded = status === 'Present' ? 10 : status === 'Late' ? 5 : 0;

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          attendanceLogs: { date: logDate, status, pointsAwarded, timestamp: new Date() },
        },
        $inc: { points: pointsAwarded },
      },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    res.status(201).json({
      success: true,
      message: `Attendance marked: ${status} (+${pointsAwarded} pts)`,
      data: { status, pointsAwarded, newTotal: student.points },
    });
  } catch (err) {
    console.error('Error saving attendance:', err.message);
    res.status(500).json({ success: false, message: 'Server error saving attendance.' });
  }
});

// ─── POST /api/students/:id/activity ─────────────────────────────────────────
// Body: { type: 'Gatha'|'Aaradhana'|'Conduct', description, pointsAwarded, date }
// Appends to activityLogs and updates total points
router.post('/:id/activity', async (req, res) => {
  try {
    const { type, description, pointsAwarded, date } = req.body;
    const logDate = date || todayIST();

    if (!['Gatha', 'Aaradhana', 'Conduct'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid activity type.' });
    }

    if (typeof pointsAwarded !== 'number') {
      return res.status(400).json({ success: false, message: 'pointsAwarded must be a number.' });
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          activityLogs: { date: logDate, type, description, pointsAwarded, loggedAt: new Date() },
        },
        $inc: { points: pointsAwarded },
      },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    res.status(201).json({
      success: true,
      message: `Activity logged: ${description} (${pointsAwarded > 0 ? '+' : ''}${pointsAwarded} pts)`,
      data: { type, description, pointsAwarded, newTotal: student.points },
    });
  } catch (err) {
    console.error('Error saving activity:', err.message);
    res.status(500).json({ success: false, message: 'Server error saving activity.' });
  }
});

module.exports = router;
