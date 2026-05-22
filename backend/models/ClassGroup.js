const mongoose = require('mongoose');

const classGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ageRange: {
      type: String,
      required: true,
      trim: true, // e.g. "6-10", "11-14"
    },
    teacherName: {
      type: String,
      required: true,
      trim: true,
    },
    timing: {
      type: String,
      required: true,
      trim: true, // e.g. "Sunday 9:00 AM – 11:00 AM"
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClassGroup', classGroupSchema);
