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

// Tất cả routes đều yêu cầu quyền admin
router.use(requireAdmin);

// GET /api/admin/posts - Danh sách bài viết (phân trang, filter)
// Query: page, limit, sortBy (createdAt|reportCount|likesCount|commentsCount), order (asc|desc), status (reported|pending_review|removed|resolved|active|all)
router.get('/posts', getAdminPosts);

// GET /api/admin/posts/:postId - Chi tiết bài viết + lịch sử moderation
router.get('/posts/:postId', getAdminPostById);

// PATCH /api/admin/posts/:postId/violation - Gỡ bài viết vi phạm
router.patch('/posts/:postId/violation', removePostViolation);

// PATCH /api/admin/posts/:postId/restore - Khôi phục bài viết
router.patch('/posts/:postId/restore', restorePost);

// GET /api/admin/moderation-logs - Lịch sử moderation
router.get('/moderation-logs', getModerationLogs);

// PATCH /api/admin/posts/:postId/report - Cập nhật report count (internal)
router.patch('/posts/:postId/report', updateReportCount);

module.exports = router;
