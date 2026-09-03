const express = require('express');
const authMiddleware = require('../middleware/auth');
const uploadPost = require('../middleware/uploadPost');
const {
  createPost,
  getPosts,
  getPostById,
  likePost,
  unlikePost,
  getPostLikes,
  commentPost,
  deletePost,
  updatePost,
  likeComment,
  reportPost,
} = require('../controllers/postController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', uploadPost.array('media', 10), createPost);

router.get('/', getPosts);

router.get('/:id', getPostById);

router.post('/:id/like', likePost);

router.delete('/:id/like', unlikePost);

router.get('/:id/likes', getPostLikes);

router.post('/:id/comment', uploadPost.single('media'), commentPost);

router.post('/:id/comments/:commentId/like', likeComment);

router.post('/:id/report', reportPost);

router.delete('/:id', deletePost);

router.put('/:id', uploadPost.array('media', 10), updatePost);

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
