const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  className: {
    type: String,
    required: true,
    trim: true,
  }, // e.g. "Bal Varg", "Kishore Varg"
  ageGroup: {
    type: String,
    required: true,
    trim: true,
  }, // e.g. "5-10", "11-15", "16+"
  attendanceLocked: {
    type: [String], // Array of 'YYYY-MM-DD' date strings
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);
