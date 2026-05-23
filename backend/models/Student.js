const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const attendanceLogSchema = new mongoose.Schema({
  date: { type: String, required: true },          // stored as 'YYYY-MM-DD' string for easy lookup
  status: { type: String, enum: ['Present', 'Absent', 'Late'], required: true },
  pointsAwarded: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

const activityLogSchema = new mongoose.Schema({
  date: { type: String, required: true },          // stored as 'YYYY-MM-DD' string
  type: { type: String, enum: ['Gatha', 'Aaradhana', 'Conduct'], required: true },
  description: { type: String, required: true },  // e.g. "Navkar Mantra"
  pointsAwarded: { type: Number, required: true }, // negative for Conduct deductions
  loggedAt: { type: Date, default: Date.now },
});

// ─── Main Schema ──────────────────────────────────────────────────────────────

const studentSchema = new mongoose.Schema({
  rollNo:       { type: String, required: true, unique: true }, // QR scanner reads this!
  name:         { type: String, required: true },
  phoneNumber:  { type: String },                               // Stored as string for '+91' etc.
  village:      { type: String },
  classId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Class' }, // Assigned class
  points:       { type: Number, default: 0 },

  // Embedded log arrays
  attendanceLogs: { type: [attendanceLogSchema], default: [] },
  activityLogs:   { type: [activityLogSchema],   default: [] },
});

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);