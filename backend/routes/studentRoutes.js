const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

// GET /api/students
// Returns all students, mapped for backward compatibility with the teacher-app frontend
router.get('/', async (req, res) => {
  try {
    const students = await Student.find().sort({ name: 1 });

    // Map new schema fields to match what the frontend teacher-app expects
    const formattedStudents = students.map(student => {
      const parts = (student.name || '').trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      return {
        _id: student._id,
        rollNo: student.rollNo,
        name: student.name,
        firstName: firstName,
        lastName: lastName,
        phoneNumber: student.phoneNumber,
        village: student.village,
        classGroupId: {
          _id: student.village || 'default',
          name: student.village || 'No Village'
        },
        points: student.points,
        totalPoints: student.points,
        qrId: student.rollNo // The QR scanner reads rollNo as the qrId!
      };
    });

    res.status(200).json({ success: true, count: formattedStudents.length, data: formattedStudents });
  } catch (err) {
    console.error('Error fetching students:', err.message);
    res.status(500).json({ success: false, message: 'Server error fetching students.' });
  }
});

module.exports = router;
