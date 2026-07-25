const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { generateAgoraToken } = require('../controllers/agoraController');

router.use(authMiddleware);

router.post('/token', generateAgoraToken);

module.exports = router;
