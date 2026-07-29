const express = require('express');
const router = express.Router();
const Court = require('../models/Court');
const CourtOwner = require('../models/CourtOwner');

// GET /api/courts?sportType=football
router.get('/', async (req, res) => {
  try {
    const { sportType, district } = req.query;
    const filter = {};
    if (sportType) filter.sportType = sportType;
    if (district) filter.district = district;

    const courts = await Court.find(filter).populate('owner').sort({ rating: -1 });
    res.json({ success: true, data: courts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/courts/:id
router.get('/:id', async (req, res) => {
  try {
    const court = await Court.findById(req.params.id).populate('owner');
    if (!court) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: court });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
