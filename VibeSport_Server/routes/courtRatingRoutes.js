const express = require('express');
const router = express.Router();
const courtRatingController = require('../controllers/courtRatingController');
const { authMiddleware } = require('../middleware/authMiddleware');

// POST - Submit or update court rating
router.post('/', authMiddleware, courtRatingController.rateCourtController);

// GET - Get all ratings for a court
router.get('/court/:courtId', courtRatingController.getCourtRatings);

// GET - Get user's rating for a court
router.get('/court/:courtId/my', authMiddleware, courtRatingController.getMyCourtRating);

module.exports = router;
