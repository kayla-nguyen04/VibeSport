const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getConversations,
  getUnreadCount,
  createOrGetConversation,
  getMessages,
  sendMessage,
  markConversationRead,
} = require('../controllers/chatController');

const router = express.Router();

router.use(authMiddleware);

router.get('/conversations', getConversations);
router.get('/unread-count', getUnreadCount);
router.post('/conversations', createOrGetConversation);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.put('/conversations/:id/read', markConversationRead);

module.exports = router;
