const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Kiểm tra an toàn để đảm bảo middleware và controller đều tồn tại
if (typeof authMiddleware !== 'function') {
  console.error('❌ Lỗi: authMiddleware chưa được export đúng dạng hàm!');
}

if (!ratingController.rateParticipants) {
  console.error('❌ Lỗi: ratingController.rateParticipants không tồn tại!');
}

if (!ratingController.getUserRatings) {
  console.error('❌ Lỗi: ratingController.getUserRatings không tồn tại!');
}

// Khai báo các đường dẫn API
router.get('/admin/list', ratingController.getAdminReputationList);
router.post('/', authMiddleware, ratingController.rateParticipants);
router.get('/user/:userId', authMiddleware, ratingController.getUserRatings);

module.exports = router;