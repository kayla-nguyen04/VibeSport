const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  savePost,
  unsavePost,
  getSavedPosts
} = require('../controllers/savedPostController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getSavedPosts);

router.post('/:postId', savePost);

router.delete('/:postId', unsavePost);

module.exports = router;
