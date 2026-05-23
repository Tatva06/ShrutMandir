const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['SuperAdmin', 'Teacher'],
    default: 'Teacher',
  },
}, { timestamps: true });

// Avoid OverwriteModelError on Vercel
module.exports = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema);
