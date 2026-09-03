const express = require('express');
const router = express.Router();
const courtRatingController = require('../controllers/courtRatingController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, courtRatingController.rateCourtController);

router.get('/court/:courtId', courtRatingController.getCourtRatings);

router.get('/court/:courtId/my', authMiddleware, courtRatingController.getMyCourtRating);

module.exports = router;
