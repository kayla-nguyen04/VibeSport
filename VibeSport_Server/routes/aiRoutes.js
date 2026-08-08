const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');

// Endpoint: POST /api/ai/chat
router.post('/chat', authMiddleware, aiController.chatWithAi);

module.exports = router;