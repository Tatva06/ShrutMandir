const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const Student = require('../models/Student');

// POST /api/attendance
// Body: { records: [ { studentId, status, pointsAwarded, teacherNotes, date? }, ... ] }
// Creates one AttendanceLog per record and increments each Student's totalPoints.
router.post('/', async (req, res) => {
  const { records } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Request body must contain a non-empty "records" array.',
    });
  }

  // Use a session so all writes are atomic — if anything fails, nothing is saved
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const createdLogs = [];

    for (const record of records) {
      const { studentId, status, pointsAwarded = 0, teacherNotes = '', date } = record;

      if (!studentId || !status) {
        throw new Error(`Each record must include "studentId" and "status". Got: ${JSON.stringify(record)}`);
      }

      // 1️⃣  Create the AttendanceLog
      const [log] = await AttendanceLog.create(
        [{ studentId, status, pointsAwarded, teacherNotes, date: date || Date.now() }],
        { session }
      );
      createdLogs.push(log);

      // 2️⃣  Increment the student's points (only when points were actually awarded)
      if (pointsAwarded !== 0) {
        await Student.findByIdAndUpdate(
          studentId,
          { $inc: { points: pointsAwarded } },
          { session }
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      count: createdLogs.length,
      data: createdLogs,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error saving attendance records:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Server error saving attendance.' });
  }
});

module.exports = router;
