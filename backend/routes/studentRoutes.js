const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

// ─── Helper ───────────────────────────────────────────────────────────────────
function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ─── GET /api/students ────────────────────────────────────────────────────────
// Returns all students (Public for app/dashboard)
router.get('/', async (req, res) => {
  try {
    const students = await Student.find().populate('classId', 'className ageGroup').sort({ name: 1 });
    const formatted = students.map(s => {
      const parts = (s.name || '').trim().split(/\s+/);
      return {
        _id: s._id,
        rollNo: s.rollNo,
        name: s.name,
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        phoneNumber: s.phoneNumber,
        altPhone: s.altPhone || '',
        fatherName: s.fatherName || '',
        motherName: s.motherName || '',
        age: s.age || null,
        gender: s.gender || '',
        dob: s.dob || '',
        village: s.village,
        classId: s.classId, // Now explicitly assigned
        classGroupId: { _id: s.village || 'default', name: s.village || 'No Village' }, // Backward compat
        points: s.points,
        totalPoints: s.points,
        qrId: s.rollNo,
        attendanceLogs: s.attendanceLogs,
        activityLogs: s.activityLogs,
      };
    });
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching students.' });
  }
});

// ─── GET /api/students/by-roll/:rollNo ──────────────────────────────────────────
// Returns a single student by their rollNo
router.get('/by-roll/:rollNo', async (req, res) => {
  try {
    const student = await Student.findOne({ rollNo: String(req.params.rollNo).trim() }).populate('classId', 'className ageGroup');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found with this roll number.' });
    }
    
    const parts = (student.name || '').trim().split(/\s+/);
    const formatted = {
      _id: student._id,
      rollNo: student.rollNo,
      name: student.name,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      phoneNumber: student.phoneNumber,
      altPhone: student.altPhone || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      age: student.age || null,
      gender: student.gender || '',
      dob: student.dob || '',
      village: student.village,
      classId: student.classId,
      classGroupId: { _id: student.village || 'default', name: student.village || 'No Village' },
      points: student.points,
      totalPoints: student.points,
      qrId: student.rollNo,
      attendanceLogs: student.attendanceLogs,
      activityLogs: student.activityLogs,
    };
    
    res.status(200).json({ success: true, data: formatted });
  } catch (err) {
    console.error('Lookup Student Error:', err);
    res.status(500).json({ success: false, message: 'Server error looking up student.' });
  }
});

// ─── POST /api/students ───────────────────────────────────────────────────────
// Add single student (Admin only)
router.post('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { rollNo, name, phoneNumber, altPhone, fatherName, motherName, age, gender, dob, village, classId, points } = req.body;
    if (!rollNo || !name) return res.status(400).json({ success: false, message: 'rollNo and name are required' });

    const student = await Student.create({
      rollNo, name, phoneNumber, altPhone, fatherName, motherName, age, gender, dob, village, classId, points: points || 0
    });
    res.status(201).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error creating student', error: err.message });
  }
});

// ─── PUT /api/students/:id ────────────────────────────────────────────────────
// Update student profile (Admin only)
router.put('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!student) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating student', error: err.message });
  }
});

// ─── GET /api/students/:id ────────────────────────────────────────────────────
// Returns a single student with paginated logs (limits to 50 to prevent crash)
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('classId', 'className ageGroup');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    // Pagination for logs: return only last 50 by default
    const limit = parseInt(req.query.limit) || 50;
    
    // Create a plain object to avoid modifying the mongoose document
    const studentData = student.toObject();
    
    // Sort descending by date and limit
    studentData.attendanceLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    studentData.activityLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    studentData.attendanceLogs = studentData.attendanceLogs.slice(0, limit);
    studentData.activityLogs = studentData.activityLogs.slice(0, limit);

    res.status(200).json({ success: true, data: studentData });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching student.' });
  }
});

// ─── POST /api/students/:id/attendance ───────────────────────────────────────
router.post('/:id/attendance', async (req, res) => {
  try {
    const { status, date, loggedBy } = req.body;
    const logDate = date || todayIST();

    // Check if attendance is already marked for this date to prevent double-scanning point inflation
    const existingLog = await Student.findOne({
      _id: req.params.id,
      'attendanceLogs.date': logDate
    });

    if (existingLog) {
      return res.status(400).json({ success: false, message: 'Attendance already marked for this date.' });
    }

    const pointsAwarded = status === 'Present' ? 10 : status === 'Late' ? 5 : 0;

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      {
        $push: { attendanceLogs: { date: logDate, status, pointsAwarded, timestamp: new Date(), loggedBy } },
        $inc: { points: pointsAwarded },
      },
      { new: true }
    );

    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    res.status(201).json({ success: true, message: `Attendance marked: ${status}`, data: { status, pointsAwarded, newTotal: student.points } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error saving attendance.' });
  }
});

// ─── DELETE /api/students/:id/attendance/:logId ───────────────────────────────
// Atomic Point Sync: deleting an attendance log subtracts its points
router.delete('/:id/attendance/:logId', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const logIndex = student.attendanceLogs.findIndex(l => l._id.toString() === req.params.logId);
    if (logIndex === -1) return res.status(404).json({ success: false, message: 'Log not found' });

    const ptsToSubtract = student.attendanceLogs[logIndex].pointsAwarded || 0;
    
    // Atomically pull the log and decrement points
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      { 
        $pull: { attendanceLogs: { _id: req.params.logId } },
        $inc: { points: -ptsToSubtract }
      },
      { new: true }
    );

    res.status(200).json({ success: true, message: 'Attendance log deleted and points synced.', newTotal: updatedStudent.points });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/students/:id/activity ─────────────────────────────────────────
router.post('/:id/activity', async (req, res) => {
  try {
    const { type, description, pointsAwarded, date, loggedBy } = req.body;
    const logDate = date || todayIST();

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      {
        $push: { activityLogs: { date: logDate, type, description, pointsAwarded, loggedAt: new Date(), loggedBy } },
        $inc: { points: pointsAwarded },
      },
      { new: true }
    );

    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.status(201).json({ success: true, message: `Activity logged`, data: { newTotal: student.points } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error saving activity.' });
  }
});

// ─── DELETE /api/students/:id/activity/:logId ─────────────────────────────────
// Atomic Point Sync: deleting an activity log subtracts its points
router.delete('/:id/activity/:logId', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const logIndex = student.activityLogs.findIndex(l => l._id.toString() === req.params.logId);
    if (logIndex === -1) return res.status(404).json({ success: false, message: 'Log not found' });

    const ptsToSubtract = student.activityLogs[logIndex].pointsAwarded || 0;
    
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      { 
        $pull: { activityLogs: { _id: req.params.logId } },
        $inc: { points: -ptsToSubtract }
      },
      { new: true }
    );

    res.status(200).json({ success: true, message: 'Activity log deleted and points synced.', newTotal: updatedStudent.points });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
