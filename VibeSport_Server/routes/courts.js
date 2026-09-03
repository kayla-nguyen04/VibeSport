const express = require('express');
const router = express.Router();
const Court = require('../models/Court');
const CourtOwner = require('../models/CourtOwner');
const CourtRating = require('../models/CourtRating');
const User = require('../models/User');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const uploadCourt = require('../middleware/uploadCourt');
const requireAdmin = require('../middleware/adminAuth');

const normalizePitchTypeValue = (value = '') => {
  const raw = String(value || '').toLowerCase();
  if (!raw) return '';
  if (raw.includes('5v5') || raw.includes('5')) return '5v5';
  if (raw.includes('7v7') || raw.includes('7')) return '7v7';
  if (raw.includes('11v11') || raw.includes('11')) return '11v11';
  if (raw.includes('1v1') || raw.includes('đơn') || raw.includes('1')) return '1v1';
  if (raw.includes('2v2') || raw.includes('đôi') || raw.includes('2')) return '2v2';
  return raw;
};

const normalizePitchOptions = (court) => {
  if (!court) return court;
  if (Array.isArray(court.pitchOptions) && court.pitchOptions.length > 0) return court;

  const rows = Array.isArray(court.priceTable) ? court.priceTable : [];
  const normalized = [];
  const seen = new Set();

  rows.forEach((row) => {
    const fieldType = String(row?.fieldType || row?.type || row?.label || '').trim();
    const price = Number(row?.pricePerHour ?? row?.price ?? 0);
    if (!fieldType || price <= 0) return;
    const pitchType = normalizePitchTypeValue(fieldType) || normalizePitchTypeValue(row?.pitchType || '');
    if (!pitchType) return;
    const key = `${String(row?.sportKey || court?.sportType || 'football')}:${pitchType}`;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({
      pitchType,
      label: fieldType,
      pricePerHour: price,
    });
  });

  if (normalized.length > 0) {
    court.pitchOptions = normalized;
    if (Array.isArray(court.priceGuide)) {
      delete court.priceGuide;
    }
  }

  return court;
};

const recalculateCourtRatingSummary = async (courtId) => {
  const ratings = await CourtRating.find({ court: courtId }).sort({ createdAt: -1 }).lean();
  const totalReviews = ratings.length;

  if (totalReviews === 0) {
    await Court.findByIdAndUpdate(courtId, {
      rating: 4.5,
      reviewCount: 0,
      reviewsCount: 0,
    });
    return { avgRating: 4.5, totalReviews: 0, ratings: [] };
  }

  const recent100 = [...ratings].slice(0, 100);
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

  await Court.findByIdAndUpdate(courtId, {
    rating: avgRating,
    reviewCount: totalReviews,
    reviewsCount: totalReviews,
  });

  return { avgRating, totalReviews, ratings };
};

async function notifyMatchParticipantsForCourt(court, actionLabel) {
  try {
    if (!court) return;
    const courtIdStr = String(court._id || court.id);
    const courtName = court.name || 'Mẫu sân';

    const matches = await Match.find({
      teamStatus: { $ne: 'ended' },
      status: { $ne: 'cancelled' },
      $or: [
        { locationName: { $regex: courtName, $options: 'i' } },
        { 'selectedCourtObj._id': courtIdStr },
        { 'selectedCourtObj.id': courtIdStr },
      ],
    });

    console.log(`[CourtNotice] Found ${matches.length} active match(es) using court "${courtName}"`);

    for (const match of matches) {
      const participants = (match.participants || []).map((p) => String(p._id || p));
      
      for (const uId of participants) {
        try {
          const notifMsg = ` Thông báo sân thi đấu: Mẫu sân "${courtName}" của trận "${match.title}" đã được ban quản trị ${actionLabel}. Tuy nhiên trận đấu của bạn vẫn sẽ tiếp tục diễn ra bình thường!`;

          await Notification.create({
            userId: uId,
            type: 'court_notice',
            matchId: match._id,
            message: notifMsg,
          });

          if (global.io) {
            global.io.to(String(uId)).emit('new_notification', {
              title: ' Thông báo sân thi đấu',
              message: notifMsg,
              matchId: match._id,
            });
          }
        } catch (nErr) {
          console.error('[CourtNotice] Notification error:', nErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[CourtNotice] Search matches error:', err.message);
  }
}

router.get('/', async (req, res) => {
  try {
    const { sportType, district, search, status } = req.query;
    const conditions = [];

    if (sportType && sportType !== 'all') {
      conditions.push({
        $or: [{ sportType: sportType }, { sports: sportType }],
      });
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        conditions.push({ status: { $nin: ['hidden', 'removed_by_admin'] } });
      } else {
        conditions.push({ status: status });
      }
    }

    if (district) {
      conditions.push({ district: district });
    }

    if (search) {
      conditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
          { district: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const queryObj = conditions.length > 0 ? { $and: conditions } : {};

    const courts = await Court.find(queryObj).populate('owner', 'name phone email picture avatar').sort({ rating: -1, createdAt: -1 });
    const normalizedCourts = courts.map((court) => normalizePitchOptions(court.toObject ? court.toObject() : court));
    res.json({ success: true, count: normalizedCourts.length, data: normalizedCourts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/upload-images', uploadCourt.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có file ảnh nào được gửi lên' });
    }
    const urls = req.files.map((f) => f.path || f.secure_url || f.url);
    res.json({ success: true, urls });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const court = await Court.findById(req.params.id).populate('owner', 'name phone email picture avatar');
    if (!court) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu sân' });
    const normalizedCourt = normalizePitchOptions(court.toObject ? court.toObject() : court);
    res.json({ success: true, data: normalizedCourt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:courtId/ratings', async (req, res) => {
  try {
    const { courtId } = req.params;
    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sân' });
    }

    const ratings = await CourtRating.find({ court: courtId })
      .populate('user', 'name picture avatar email')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: ratings,
      avgRating: court.rating || 4.5,
      totalReviews: ratings.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:courtId/ratings', async (req, res) => {
  try {
    const { courtId } = req.params;
    const { userId, stars, comment } = req.body;

    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sân' });
    }

    if (!userId || !stars || Number(stars) < 1 || Number(stars) > 5) {
      return res.status(400).json({ success: false, message: 'userId và số sao không hợp lệ' });
    }

    const foundUser = await User.findById(userId);
    if (!foundUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const newRating = await CourtRating.create({
      court: courtId,
      user: userId,
      stars: Number(stars),
      comment: String(comment || '').trim(),
    });

    const summary = await recalculateCourtRatingSummary(courtId);
    const populated = await CourtRating.findById(newRating._id).populate('user', 'name picture avatar email').lean();

    return res.status(201).json({
      success: true,
      message: 'Thêm đánh giá sân thành công',
      data: populated,
      summary,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:courtId/ratings/:ratingId', async (req, res) => {
  try {
    const { courtId, ratingId } = req.params;
    const { stars, comment } = req.body;

    const review = await CourtRating.findOne({ _id: ratingId, court: courtId });
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá sân' });
    }

    review.stars = Number(stars) || review.stars;
    review.comment = String(comment ?? review.comment).trim();
    await review.save();

    const summary = await recalculateCourtRatingSummary(courtId);
    const populated = await CourtRating.findById(review._id).populate('user', 'name picture avatar email').lean();

    return res.json({
      success: true,
      message: 'Cập nhật đánh giá sân thành công',
      data: populated,
      summary,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:courtId/ratings/:ratingId', async (req, res) => {
  try {
    const { courtId, ratingId } = req.params;
    const review = await CourtRating.findOne({ _id: ratingId, court: courtId });
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá sân' });
    }

    await CourtRating.deleteOne({ _id: ratingId, court: courtId });
    const summary = await recalculateCourtRatingSummary(courtId);

    return res.json({
      success: true,
      message: 'Đã xóa đánh giá sân',
      summary,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/courts (Tạo mẫu sân mới)
router.post('/', async (req, res) => {
  try {
    const requestBody = { ...req.body };
    if (!requestBody.owner || requestBody.owner === '' || requestBody.owner === 'null') {
      requestBody.owner = null;
    }
    if (!requestBody.pitchOptions && Array.isArray(requestBody.priceTable) && requestBody.priceTable.length > 0) {
      requestBody.pitchOptions = normalizePitchOptions({ ...requestBody }).pitchOptions || [];
    }
    delete requestBody.priceGuide;

    const newCourt = new Court(requestBody);
    await newCourt.save();
    const populated = await Court.findById(newCourt._id).populate('owner', 'name phone email picture avatar');
    res.status(201).json({ success: true, message: 'Thêm mẫu sân mới thành công', data: populated });
  } catch (err) {
    console.error('[CourtCreateError]', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/courts/:id (Cập nhật mẫu sân)
router.put('/:id', async (req, res) => {
  try {
    const oldCourt = await Court.findById(req.params.id);
    if (!oldCourt) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu sân để cập nhật' });

    const requestBody = { ...req.body };
    if (!requestBody.owner || requestBody.owner === '' || requestBody.owner === 'null') {
      requestBody.owner = null;
    }
    if (!requestBody.pitchOptions && Array.isArray(requestBody.priceTable) && requestBody.priceTable.length > 0) {
      requestBody.pitchOptions = normalizePitchOptions({ ...oldCourt.toObject(), ...requestBody }).pitchOptions || [];
    }
    delete requestBody.priceGuide;

    const updated = await Court.findByIdAndUpdate(req.params.id, requestBody, { returnDocument: 'after' }).populate('owner', 'name phone email picture avatar');

    // Nếu chuyển trạng thái sang hidden (Ẩn sân)
    if (req.body.status === 'hidden' && oldCourt.status !== 'hidden') {
      notifyMatchParticipantsForCourt(updated, 'Ẩn khỏi danh sách');
    }

    res.json({ success: true, message: 'Cập nhật mẫu sân thành công', data: updated });
  } catch (err) {
    console.error('[CourtUpdateError]', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/courts/:id (Xóa mẫu sân)
router.delete('/:id', async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);
    if (!court) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu sân để xóa' });

    court.status = 'removed_by_admin';
    court.removedAt = new Date();
    await court.save();

    // Gửi thông báo đến người dùng trong các trận đấu sử dụng sân vừa bị xóa
    notifyMatchParticipantsForCourt(court, 'Xóa khỏi hệ thống');

    res.json({ success: true, message: 'Đã chuyển sân vào phần Nội dung đã xóa' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;


