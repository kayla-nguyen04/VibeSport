const express = require('express');
const requireAdmin = require('../middleware/adminAuth');
const {
  removePostViolation,
  restorePost,
  getAdminPosts,
  getAdminPostById,
  getModerationLogs,
  updateReportCount,
} = require('../controllers/adminPostController');

const router = express.Router();

router.use(requireAdmin);

router.get('/posts', getAdminPosts);

router.get('/posts/:postId', getAdminPostById);

router.patch('/posts/:postId/violation', removePostViolation);

router.patch('/posts/:postId/restore', restorePost);

router.get('/moderation-logs', getModerationLogs);

router.patch('/posts/:postId/report', updateReportCount);

module.exports = router;
