const express = require('express');
const authMiddleware = require('../middleware/auth');
const uploadPost = require('../middleware/uploadPost');
const {
  createPost,
  getPosts,
  getPostById,
  likePost,
  commentPost,
  deletePost,
} = require('../controllers/postController');

const router = express.Router();

// Tất cả các routes liên quan đến bài viết đều qua authMiddleware để phục vụ xác thực người dùng và xác định trạng thái likes
router.use(authMiddleware);

// POST /api/posts — Tạo bài viết mới (hỗ trợ upload tối đa 10 ảnh/video qua key 'media')
router.post('/', uploadPost.array('media', 10), createPost);

// GET /api/posts — Lấy danh sách bài viết phân trang
router.get('/', getPosts);

// GET /api/posts/:id — Lấy chi tiết bài viết
router.get('/:id', getPostById);

// POST /api/posts/:id/like — Thích / Bỏ thích bài viết
router.post('/:id/like', likePost);

// POST /api/posts/:id/comment — Bình luận bài viết
router.post('/:id/comment', commentPost);

// DELETE /api/posts/:id — Xóa bài viết
router.delete('/:id', deletePost);

module.exports = router;
