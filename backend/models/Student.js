const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  rollNo: { type: String, required: true, unique: true }, // The QR scanner will read this!
  name: { type: String, required: true },
  phoneNumber: { type: String }, // Stored as a string in case of '+91' or spaces
  village: { type: String },
  points: { type: Number, default: 0 }
});

module.exports = mongoose.model('Student', studentSchema);