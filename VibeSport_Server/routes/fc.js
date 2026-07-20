const express = require('express');
const authMiddleware = require('../middleware/auth');
const uploadPost = require('../middleware/uploadPost'); // Reusing Cloudinary upload storage config
const {
  createFC,
  searchFC,
  getFCDetails,
  joinFC,
  leaveFC,
  approveJoinRequest,
  updateFC,
  deleteFC,
} = require('../controllers/fcController');

const router = express.Router();

router.use(authMiddleware);

// POST /api/fc - Create a new FC
router.post('/', uploadPost.fields([{ name: 'avatar', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), createFC);

// GET /api/fc/search - Search FCs by name
router.get('/search', searchFC);

// GET /api/fc/:id - Get details of an FC
router.get('/:id', getFCDetails);

// PUT /api/fc/:id - Edit FC details
router.put('/:id', uploadPost.fields([{ name: 'avatar', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), updateFC);

// DELETE /api/fc/:id - Delete an FC
router.delete('/:id', deleteFC);

// POST /api/fc/:id/join - Join an FC
router.post('/:id/join', joinFC);

// POST /api/fc/:id/approve-join - Approve a pending join request
router.post('/:id/approve-join', approveJoinRequest);

// POST /api/fc/:id/leave - Leave an FC
router.post('/:id/leave', leaveFC);

module.exports = router;
