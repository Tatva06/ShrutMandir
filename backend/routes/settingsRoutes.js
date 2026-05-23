const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

// ─── Helper: Get or Create Settings ───────────────────────────────────────────
async function getSettings() {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({}); // Creates default settings
  }
  return settings;
}

// ─── GET /api/settings ────────────────────────────────────────────────────────
// Public route (Mobile app needs this to know Gathas and cutoff time)
router.get('/', async (req, res) => {
  try {
    const settings = await getSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching settings.' });
  }
});

// ─── PUT /api/settings ────────────────────────────────────────────────────────
// Update global settings (SuperAdmin only)
router.put('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { lateCutoffTime, gathaList } = req.body;
    const settings = await getSettings();

    if (lateCutoffTime !== undefined) settings.lateCutoffTime = lateCutoffTime;
    if (gathaList !== undefined) settings.gathaList = gathaList;

    await settings.save();
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error updating settings.' });
  }
});

module.exports = router;
