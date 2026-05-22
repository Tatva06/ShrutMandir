const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

// GET /api/students
// Returns all students, each populated with their ClassGroup details
router.get('/', async (req, res) => {
  try {
    const students = await Student.find()
      .populate('classGroupId')
      .sort({ lastName: 1, firstName: 1 });

    res.status(200).json({ success: true, count: students.length, data: students });
  } catch (err) {
    console.error('Error fetching students:', err.message);
    res.status(500).json({ success: false, message: 'Server error fetching students.' });
  }
});

module.exports = router;
