const express = require('express');
const router = express.Router();
const Court = require('../models/Court');
const User = require('../models/User');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const uploadCourt = require('../middleware/uploadCourt');

// Hàm gửi thông báo tới các user trong các trận đấu đang sử dụng sân bị Ẩn/Xóa
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

async function notifyMatchParticipantsForCourt(court, actionLabel) {
  try {
    if (!court) return;
    const courtIdStr = String(court._id || court.id);
    const courtName = court.name || 'Mẫu sân';

    // Tìm tất cả các trận đấu đang diễn ra hoặc chưa bắt đầu có chọn mẫu sân này
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
      // TRẬN ĐẤU VẪN ĐƯỢC TIẾP TỤC BÌNH THƯỜNG - CHỈ GỬI THÔNG BÁO CHO CÁC USER TRONG TRẬN
      const participants = (match.participants || []).map((p) => String(p._id || p));
      
      for (const uId of participants) {
        try {
          const notifMsg = `📢 Thông báo sân thi đấu: Mẫu sân "${courtName}" của trận "${match.title}" đã được ban quản trị ${actionLabel}. Tuy nhiên trận đấu của bạn vẫn sẽ tiếp tục diễn ra bình thường!`;

          await Notification.create({
            userId: uId,
            type: 'court_notice',
            matchId: match._id,
            message: notifMsg,
          });

          if (global.io) {
            global.io.to(String(uId)).emit('new_notification', {
              title: '📢 Thông báo sân thi đấu',
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

// GET /api/courts (hoặc /api/admin/courts)
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

    const courts = await Court.find(queryObj).populate('owner', 'name phone email avatar').sort({ rating: -1, createdAt: -1 });
    const normalizedCourts = courts.map((court) => normalizePitchOptions(court.toObject ? court.toObject() : court));
    res.json({ success: true, count: normalizedCourts.length, data: normalizedCourts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/courts/upload-images (Upload ảnh sân lên Cloudinary, trả về URLs)
// ⚠️ Phải đặt TRƯỚC /:id routes để tránh Express match 'upload-images' như một :id param
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

// GET /api/courts/:id
router.get('/:id', async (req, res) => {
  try {
    const court = await Court.findById(req.params.id).populate('owner', 'name phone email avatar');
    if (!court) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu sân' });
    const normalizedCourt = normalizePitchOptions(court.toObject ? court.toObject() : court);
    res.json({ success: true, data: normalizedCourt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/courts (Tạo mẫu sân mới)
router.post('/', async (req, res) => {
  try {
    const requestBody = { ...req.body };
    if (!requestBody.pitchOptions && Array.isArray(requestBody.priceTable) && requestBody.priceTable.length > 0) {
      requestBody.pitchOptions = normalizePitchOptions({ ...requestBody }).pitchOptions || [];
    }
    delete requestBody.priceGuide;

    const newCourt = new Court(requestBody);
    await newCourt.save();
    const populated = await Court.findById(newCourt._id).populate('owner', 'name phone email avatar');
    res.status(201).json({ success: true, message: 'Thêm mẫu sân mới thành công', data: populated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/courts/:id (Cập nhật mẫu sân)
router.put('/:id', async (req, res) => {
  try {
    const oldCourt = await Court.findById(req.params.id);
    if (!oldCourt) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu sân để cập nhật' });

    const requestBody = { ...req.body };
    if (!requestBody.pitchOptions && Array.isArray(requestBody.priceTable) && requestBody.priceTable.length > 0) {
      requestBody.pitchOptions = normalizePitchOptions({ ...oldCourt.toObject(), ...requestBody }).pitchOptions || [];
    }
    delete requestBody.priceGuide;

    const updated = await Court.findByIdAndUpdate(req.params.id, requestBody, { returnDocument: 'after' }).populate('owner', 'name phone email avatar');

    // Nếu chuyển trạng thái sang hidden (Ẩn sân)
    if (req.body.status === 'hidden' && oldCourt.status !== 'hidden') {
      notifyMatchParticipantsForCourt(updated, 'Ẩn khỏi danh sách');
    }

    res.json({ success: true, message: 'Cập nhật mẫu sân thành công', data: updated });
  } catch (err) {
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
