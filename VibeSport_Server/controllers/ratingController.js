const Rating = require('../models/Rating');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Hàm gửi đánh giá
exports.rateParticipants = async (req, res) => {
  try {
    const fromUserId = req.user.id || req.user._id;
    const { matchId, ratings } = req.body;

    if (!matchId || !Array.isArray(ratings) || ratings.length === 0) {
      return res.status(400).json({ message: 'Dữ liệu đánh giá không hợp lệ.' });
    }

    const createdRatings = [];
    const sender = await User.findById(fromUserId).select('name');

    for (const item of ratings) {
      const { toUserId, stars, comment } = item;
      if (!toUserId || !stars || stars < 1 || stars > 5) continue;

      // 1. Lưu hoặc cập nhật đánh giá
      const ratingDoc = await Rating.findOneAndUpdate(
        { fromUser: fromUserId, toUser: toUserId, matchId },
        { stars, comment: comment || '' },
        { upsert: true, new: true, runValidators: true }
      );
      createdRatings.push(ratingDoc);

      // 2. Tính lại điểm Rating trung bình
      const userRatings = await Rating.find({ toUser: toUserId });
      if (userRatings.length > 0) {
        const totalStars = userRatings.reduce((sum, r) => sum + r.stars, 0);
        const avgRating = Number((totalStars / userRatings.length).toFixed(1));
        await User.findByIdAndUpdate(toUserId, { rating: avgRating });
      }

      // 3. Tự động tạo thông báo cho người nhận
      try {
        await Notification.create({
          userId: toUserId,
          title: 'Đánh giá mới ⭐',
          message: `${sender?.name || 'Bạn đấu'} đã đánh giá bạn ${stars} sao!`,
          type: 'rating',
          relatedId: matchId,
        });
      } catch (notifErr) {
        console.warn('Không thể tạo thông báo đánh giá:', notifErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật đánh giá thành công!',
      data: createdRatings,
    });
  } catch (error) {
    console.error('[ratingController] rateParticipants error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lưu đánh giá.' });
  }
};

// Hàm lấy danh sách đánh giá của 1 user
exports.getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;

    const ratings = await Rating.find({ toUser: userId })
      .populate('fromUser', 'name picture')
      .populate('matchId', 'title date sport')
      .sort({ createdAt: -1 });

    const user = await User.findById(userId).select('rating name picture');
    const avgRating = user?.rating && user.rating > 0 ? user.rating : 5.0;

    return res.status(200).json({
      success: true,
      data: {
        avgRating,
        totalReviews: ratings.length,
        ratings,
      },
    });
  } catch (error) {
    console.error('[ratingController] getUserRatings error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đánh giá.' });
  }
};