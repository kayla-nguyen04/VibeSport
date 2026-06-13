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

// GET /api/notifications - Get list of user notifications
router.get('/', getNotifications);

// GET /api/notifications/unread-count - Get count of unread notifications
router.get('/unread-count', getUnreadCount);

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', markAllRead);

// PUT /api/notifications/:id/read - Mark a single notification as read
router.put('/:id/read', markOneRead);

module.exports = router;
