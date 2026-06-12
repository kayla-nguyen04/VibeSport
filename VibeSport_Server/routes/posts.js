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
  updatePost,
  likeComment,
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

// POST /api/posts/:id/comment — Bình luận bài viết (hỗ trợ upload 1 ảnh qua key 'media')
router.post('/:id/comment', uploadPost.single('media'), commentPost);

// POST /api/posts/:id/comments/:commentId/like — Thích / Bỏ thích bình luận
router.post('/:id/comments/:commentId/like', likeComment);

// DELETE /api/posts/:id — Xóa bài viết
router.delete('/:id', deletePost);

// PUT /api/posts/:id — Sửa bài viết (chỉ chủ bài)
router.put('/:id', uploadPost.array('media', 10), updatePost);

// Xử lý lỗi từ multer (file quá lớn, sai định dạng) — trả JSON thay vì HTML
router.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File quá lớn. Tối đa 50MB mỗi file.' });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message || 'Lỗi khi tải file lên.' });
  }
  next();
});

module.exports = router;
