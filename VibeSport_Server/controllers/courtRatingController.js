const CourtRating = require('../models/CourtRating');
const Court = require('../models/Court');
const User = require('../models/User');
const Notification = require('../models/Notification');

const calculateCourtAverageRating = (ratings) => {
  const recent100 = [...ratings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
  const K = recent100.length;

  let avgRating = 5.0;
  if (K >= 100) {
    const totalStars = recent100.reduce((sum, r) => sum + Number(r.stars || 0), 0);
    avgRating = Number((totalStars / 100).toFixed(1));
  } else {
    const actualStars = recent100.reduce((sum, r) => sum + Number(r.stars || 0), 0);
    const defaultStars = (100 - K) * 5;
    avgRating = Number(((actualStars + defaultStars) / 100).toFixed(1));
  }

  return avgRating;
};

exports.rateCourtController = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { courtId, stars, comment } = req.body;

    if (!courtId || !stars || stars < 1 || stars > 5) {
      return res.status(400).json({ message: 'Dữ liệu đánh giá sân không hợp lệ.' });
    }

    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({ message: 'Không tìm thấy sân.' });
    }

    const existing = await CourtRating.findOne({ user: userId, court: courtId });
    if (existing) {
      existing.stars = stars;
      existing.comment = comment || '';
      await existing.save();
      return res.status(200).json({
        success: true,
        message: 'Cập nhật đánh giá sân thành công!',
        data: existing,
      });
    }

    const rating = await CourtRating.create({
      user: userId,
      court: courtId,
      stars,
      comment: comment || '',
    });

    const allRatings = await CourtRating.find({ court: courtId }).sort({ createdAt: -1 });
    if (allRatings.length > 0) {
      const avgRating = calculateCourtAverageRating(allRatings);
      await Court.findByIdAndUpdate(courtId, {
        rating: avgRating,
        reviewsCount: allRatings.length,
        reviewCount: allRatings.length,
      });
    }

    try {
      if (court.owner) {
        const owner = typeof court.owner === 'object' ? court.owner._id : court.owner;
        const rater = await User.findById(userId).select('name');
        await Notification.create({
          userId: owner,
          title: 'Đánh giá sân mới ⭐',
          message: `${rater?.name || 'Người dùng'} đã đánh giá sân ${court.name} ${stars} sao!`,
          type: 'court_rating',
          relatedId: courtId,
        });
      }
    } catch (notifErr) {
      console.warn('Không thể tạo thông báo đánh giá sân:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Đánh giá sân thành công!',
      data: rating,
    });
  } catch (error) {
    console.error('[courtRatingController] rateCourtController error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lưu đánh giá sân.' });
  }
};

exports.getCourtRatings = async (req, res) => {
  try {
    const { courtId } = req.params;

    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({ message: 'Không tìm thấy sân.' });
    }

    const ratings = await CourtRating.find({ court: courtId })
      .populate('user', 'name picture avatar')
      .sort({ createdAt: -1 });

    const totalReviews = ratings.length;
    const avgRating = totalReviews > 0 ? calculateCourtAverageRating(ratings) : 0;

    return res.status(200).json({
      success: true,
      data: {
        avgRating: Number(avgRating),
        totalReviews,
        ratings,
      },
    });
  } catch (error) {
    console.error('[courtRatingController] getCourtRatings error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đánh giá sân.' });
  }
};

exports.getMyCourtRating = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { courtId } = req.params;

    const rating = await CourtRating.findOne({ user: userId, court: courtId })
      .populate('court', 'name');

    return res.status(200).json({
      success: true,
      data: rating,
    });
  } catch (error) {
    console.error('[courtRatingController] getMyCourtRating error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy đánh giá sân của bạn.' });
  }
};
