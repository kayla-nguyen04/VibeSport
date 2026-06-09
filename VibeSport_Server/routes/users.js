const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getUserProfile,
  toggleFollow,
  getUserTeams,
  getNotifications,
  markNotificationsRead,
  updatePresence,
} = require('../controllers/userController');

const router = express.Router();

router.use(authMiddleware);

router.get('/notifications', getNotifications);
router.post('/notifications/read', markNotificationsRead);
router.post('/presence', updatePresence);
router.get('/:id', getUserProfile);
router.post('/:id/follow', toggleFollow);
router.get('/:id/teams', getUserTeams);

module.exports = router;
