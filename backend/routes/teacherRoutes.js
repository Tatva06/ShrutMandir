const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Teacher = require('../models/Teacher');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

// ─── GET /api/teachers ────────────────────────────────────────────────────────
// List all teachers (Admin only)
router.get('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const teachers = await Teacher.find().select('-passwordHash').sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: teachers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching teachers.' });
  }
});

// ─── POST /api/teachers ───────────────────────────────────────────────────────
// Add a new teacher (Admin only)
router.post('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    
    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, username, and password are required.' });
    }

    const existingUser = await Teacher.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username is already taken.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newTeacher = await Teacher.create({
      name,
      username: username.toLowerCase(),
      passwordHash,
      role: role || 'Teacher'
    });

    res.status(201).json({ 
      success: true, 
      data: {
        _id: newTeacher._id,
        name: newTeacher.name,
        username: newTeacher.username,
        role: newTeacher.role
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error creating teacher.' });
  }
});

// ─── DELETE /api/teachers/:id ─────────────────────────────────────────────────
// Delete a teacher (Admin only)
router.delete('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    // Prevent deleting the very last SuperAdmin
    const teacherToDelete = await Teacher.findById(req.params.id);
    if (!teacherToDelete) return res.status(404).json({ success: false, message: 'Teacher not found' });

    if (teacherToDelete.role === 'SuperAdmin') {
      const adminCount = await Teacher.countDocuments({ role: 'SuperAdmin' });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot delete the only SuperAdmin.' });
      }
    }

    await Teacher.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Teacher deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error deleting teacher.' });
  }
});

module.exports = router;
