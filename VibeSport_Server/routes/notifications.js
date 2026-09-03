const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getNotifications);

router.get('/unread-count', getUnreadCount);

router.put('/read-all', markAllRead);

router.put('/:id/read', markOneRead);

module.exports = router;
