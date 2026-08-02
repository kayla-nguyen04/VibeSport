const Rating = require('../models/Rating');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Match = require('../models/Match');

// Hàm gửi đánh giá
exports.rateParticipants = async (req, res) => {
  try {
    const fromUserId = req.user.id || req.user._id;
    const { matchId, ratings } = req.body;

    if (!matchId || !Array.isArray(ratings) || ratings.length === 0) {
      return res.status(400).json({ message: 'Dữ liệu đánh giá không hợp lệ.' });
    }

    const matchDoc = await Match.findById(matchId);
    if (!matchDoc) {
      return res.status(404).json({ message: 'Không tìm thấy trận đấu.' });
    }

    // Kiểm tra trận đấu đã kết thúc chưa
    if (matchDoc.teamStatus !== 'ended' && matchDoc.status !== 'completed') {
      return res.status(400).json({ message: 'Chỉ có thể đánh giá người chơi sau khi trận đấu đã kết thúc.' });
    }

    // Kiểm tra người gửi đánh giá có phải là thành viên trong trận đấu không
    const isSenderInMatch = matchDoc.participants.some(
      (p) => String(p._id || p) === String(fromUserId)
    );
    if (!isSenderInMatch) {
      return res.status(403).json({ message: 'Bạn không phải là thành viên tham gia trận đấu này.' });
    }

    const createdRatings = [];
    const sender = await User.findById(fromUserId).select('name');

    const skipped = [];
    for (const item of ratings) {
      const { toUserId, stars, comment } = item;
      if (!toUserId || !stars || stars < 1 || stars > 5) continue;

      // Kiểm tra người được đánh giá có tham gia trận đấu này không
      const isTargetInMatch = matchDoc.participants.some(
        (p) => String(p._id || p) === String(toUserId)
      );
      if (!isTargetInMatch) continue;

      // 1. Kiểm tra xem người gửi đã từng đánh giá target trong trận này chưa
      const existing = await Rating.findOne({ fromUser: fromUserId, toUser: toUserId, matchId });
      if (existing) {
        skipped.push({ toUserId, reason: 'already_rated' });
        continue;
      }

      // Tạo mới đánh giá (không cho phép cập nhật lại để đảm bảo 1 người 1 lần)
      const ratingDoc = await Rating.create({
        fromUser: fromUserId,
        toUser: toUserId,
        matchId,
        stars,
        comment: comment || '',
      });
      createdRatings.push(ratingDoc);

      // 2. Tính lại điểm Rating trung bình 100 điểm đánh giá gần nhất (Grab Style)
      const userRatings = await Rating.find({ toUser: toUserId })
        .sort({ createdAt: -1 })
        .limit(100);

      let avgRating = 5.0;
      if (userRatings.length > 0) {
        const totalStars = userRatings.reduce((sum, r) => sum + r.stars, 0);
        avgRating = Number((totalStars / userRatings.length).toFixed(1));
      }

      // Kiểm tra điều kiện khóa tài khoản (< 2.0 sao)
      const shouldLockAccount = avgRating < 2.0;

      await User.findByIdAndUpdate(toUserId, {
        rating: avgRating,
        ...(shouldLockAccount ? { isLocked: true } : {}),
      });

      // 3. Tự động tạo thông báo cho người nhận
      try {
        await Notification.create({
          userId: toUserId,
          title: 'Đánh giá mới ⭐',
          message: `${sender?.name || 'Bạn đấu'} đã đánh giá bạn ${stars} sao! (Điểm TB hiện tại: ${avgRating}⭐)`,
          type: 'rating',
          relatedId: matchId,
        });

        // HỆ THỐNG CẢNH BÁO SAO (STAR WARNING & BAN SYSTEM)
        if (avgRating < 2.0) {
          // Dưới 2 sao => BAN ACCOUNT (Khóa tài khoản)
          await Notification.create({
            userId: toUserId,
            title: '⛔ TÀI KHOẢN ĐÃ BỊ KHÓA',
            message: `Tài khoản của bạn đã bị KHÓA do điểm đánh giá trung bình 100 trận gần nhất rơi xuống dưới 2.0⭐ (${avgRating}⭐). Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.`,
            type: 'rating_warning',
            relatedId: matchId,
          });

          if (global.io) {
            const targetRoom = String(toUserId);
            global.io.to(targetRoom).emit('account_locked', {
              reason: `Điểm đánh giá trung bình 100 trận gần nhất rơi xuống dưới 2.0⭐ (${avgRating}⭐)`,
              avgRating,
            });
          }
        } else if (avgRating < 3.0) {
          // Dưới 3 sao => CẢNH BÁO USER
          await Notification.create({
            userId: toUserId,
            title: '⚠️ CẢNH BÁO ĐIỂM ĐÁNH GIÁ THẤP',
            message: `Điểm đánh giá trung bình 100 trận gần nhất của bạn hiện tại là ${avgRating}⭐ (Dưới 3.0⭐). Vui lòng duy trì thái độ thi đấu văn minh để tránh bị khóa tài khoản!`,
            type: 'rating_warning',
            relatedId: matchId,
          });

          if (global.io) {
            const targetRoom = String(toUserId);
            global.io.to(targetRoom).emit('new_notification', {
              title: '⚠️ Cảnh báo điểm đánh giá',
              message: `Điểm đánh giá trung bình của bạn là ${avgRating}⭐ (Dưới 3.0⭐). Vui lòng chú ý thái độ thi đấu!`,
            });
          }
        }
      } catch (notifErr) {
        console.warn('Không thể tạo thông báo đánh giá:', notifErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật đánh giá thành công!',
      data: { created: createdRatings, skipped },
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
      .populate('matchId', 'title date sport locationName specificAddress')
      .sort({ createdAt: -1 });

    const user = await User.findById(userId).select('rating name picture isLocked');
    const recent100 = ratings.slice(0, 100);
    const avgRating = recent100.length > 0
      ? Number((recent100.reduce((sum, r) => sum + r.stars, 0) / recent100.length).toFixed(1))
      : (user?.rating || 5.0);

    return res.status(200).json({
      success: true,
      data: {
        avgRating,
        totalReviews: ratings.length,
        ratings,
        isLocked: user?.isLocked || false,
      },
    });
  } catch (error) {
    console.error('[ratingController] getUserRatings error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đánh giá.' });
  }
};

// Hàm Admin lấy danh sách người dùng, điểm sao trung bình và lịch sử bị đánh giá
exports.getAdminReputationList = async (req, res) => {
  try {
    const { search } = req.query;

    const users = await User.find({})
      .select('name email phone avatar picture rating isLocked lockReason createdAt')
      .sort({ rating: 1, createdAt: -1 })
      .lean();

    const allRatings = await Rating.find({})
      .populate('fromUser', 'name avatar picture email')
      .populate('toUser', 'name avatar picture email')
      .populate('matchId', 'title sport startTime date locationName')
      .sort({ createdAt: -1 })
      .lean();

    const ratingsByUser = {};
    for (const r of allRatings) {
      if (!r.toUser) continue;
      const toId = String(r.toUser._id || r.toUser);
      if (!ratingsByUser[toId]) ratingsByUser[toId] = [];
      ratingsByUser[toId].push(r);
    }

    let result = users.map((u) => {
      const uId = String(u._id);
      const history = ratingsByUser[uId] || [];
      const recent100 = history.slice(0, 100);
      const totalStars = recent100.reduce((sum, r) => sum + r.stars, 0);
      const avgRating = recent100.length > 0
        ? Number((totalStars / recent100.length).toFixed(1))
        : Number(u.rating || 5.0);

      return {
        ...u,
        rating: avgRating,
        totalReviews: history.length,
        receivedRatings: history,
      };
    });

    if (search && search.trim()) {
      const kw = search.trim().toLowerCase();
      result = result.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(kw) ||
          (u.email || '').toLowerCase().includes(kw) ||
          (u.phone || '').toLowerCase().includes(kw)
      );
    }

    res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    console.error('[ratingController] getAdminReputationList error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Trả về danh sách userId mà current user đã đánh giá trong 1 trận
exports.getMyRatingsForMatch = async (req, res) => {
  try {
    const fromUserId = req.user.id || req.user._id;
    const { matchId } = req.params;
    if (!matchId) return res.status(400).json({ message: 'matchId is required' });

    const rows = await Rating.find({ matchId, fromUser: fromUserId }).select('toUser -_id').lean();
    const toUserIds = rows.map((r) => String(r.toUser));
    return res.status(200).json({ success: true, data: toUserIds });
  } catch (err) {
    console.error('[ratingController] getMyRatingsForMatch error:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy dữ liệu đánh giá của bạn.' });
  }
};