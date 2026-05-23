const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late'],
      required: true,
    },
    pointsAwarded: {
      type: Number,
      default: 0,
    },
    teacherNotes: {
      type: String,
      trim: true,
      default: '',
    },
    parentAcknowledged: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.AttendanceLog || mongoose.model('AttendanceLog', attendanceLogSchema);
