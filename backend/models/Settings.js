const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Global configuration object (only one document should exist)
  lateCutoffTime: {
    type: String,
    default: '09:15', // Stored as "HH:mm"
  },
  gathaList: {
    type: [
      {
        name: { type: String, required: true },
        pts: { type: Number, required: true },
      }
    ],
    default: [
      { name: 'Navkar Mantra', pts: 10 },
      { name: 'Logassa Sutra', pts: 20 },
      { name: 'Uvasaggaharam Stotra', pts: 20 },
      { name: 'Bhaktamar Stotra', pts: 50 },
      { name: 'Namutthunam Sutra', pts: 15 },
      { name: 'Aarti', pts: 10 },
    ],
  },
}, { timestamps: true });

// Avoid OverwriteModelError on Vercel
module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
