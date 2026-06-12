const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  savePost,
  unsavePost,
  getSavedPosts
} = require('../controllers/savedPostController');

const router = express.Router();

// Tất cả các route yêu cầu xác thực người dùng
router.use(authMiddleware);

// GET /api/saved-posts — Lấy danh sách bài viết đã lưu của user
router.get('/', getSavedPosts);

// POST /api/saved-posts/:postId — Lưu bài viết
router.post('/:postId', savePost);

// DELETE /api/saved-posts/:postId — Bỏ lưu bài viết
router.delete('/:postId', unsavePost);

module.exports = router;
