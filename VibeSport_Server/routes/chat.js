const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getConversations,
  getUnreadCount,
  createOrGetConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  acceptConversation,
  blockConversation,
  unblockConversation,
  deleteConversation,
  muteConversation,
  unmuteConversation,
  deletePendingMessages,
} = require('../controllers/chatController');

const router = express.Router();

router.use(authMiddleware);

router.get('/conversations', getConversations);
router.get('/unread-count', getUnreadCount);
router.post('/conversations', createOrGetConversation);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.put('/conversations/:id/read', markConversationRead);
router.put('/conversations/:id/accept', acceptConversation);
router.put('/conversations/:id/block', blockConversation);
router.put('/conversations/:id/unblock', unblockConversation);
router.delete('/conversations/:id', deleteConversation);
router.put('/conversations/:id/mute', muteConversation);
router.put('/conversations/:id/unmute', unmuteConversation);
router.put('/conversations/:id/delete-pending', deletePendingMessages);

module.exports = router;
