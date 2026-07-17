const express = require('express');
const User = require('../models/User');
const ReportUser = require('../models/ReportUser');
const requireAdmin = require('../middleware/adminAuth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || '';

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status === 'reported') {
      query.reportCount = { $gt: 0 };
    }

    let sort = { createdAt: -1 };
    if (sortBy === 'reportCount') {
      sort = { reportCount: -1 };
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash -googleId')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách users:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

router.patch('/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['Admin', 'User'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role không hợp lệ' });
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select('-passwordHash -googleId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    res.json({ success: true, data: user, message: 'Cập nhật quyền thành công' });
  } catch (error) {
    console.error('Lỗi khi cập nhật role:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

router.patch('/:id/lock', async (req, res) => {
  try {
    const { id } = req.params;
    const { isLocked } = req.body;

    if (typeof isLocked !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isLocked phải là boolean' });
    }

    const user = await User.findByIdAndUpdate(id, { isLocked }, { new: true }).select('-passwordHash -googleId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    res.json({ 
      success: true, 
      data: user, 
      message: isLocked ? 'Đã khóa tài khoản người dùng' : 'Đã mở khóa tài khoản người dùng' 
    });
  } catch (error) {
    console.error('Lỗi khi khóa/mở khóa:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/admin/users/:id/reports - Lấy danh sách báo cáo chi tiết của một người dùng
router.get('/:id/reports', async (req, res) => {
  try {
    const { id } = req.params;
    
    const reports = await ReportUser.find({ reportedUserId: id, status: 'pending' })
      .populate('reporterId', 'name email picture')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Lỗi khi lấy báo cáo người dùng:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// PATCH /api/admin/users/:id/resolve-reports - Giải quyết báo cáo (bỏ qua / duyệt)
router.patch('/:id/resolve-reports', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Tìm user và đặt reportCount về 0
    const user = await User.findByIdAndUpdate(id, { reportCount: 0 }, { new: true }).select('-passwordHash -googleId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Đánh dấu tất cả report liên quan là resolved
    await ReportUser.updateMany({ reportedUserId: id, status: 'pending' }, { status: 'resolved' });

    res.json({
      success: true,
      data: user,
      message: 'Đã giải quyết tất cả báo cáo cho người dùng này'
    });
  } catch (error) {
    console.error('Lỗi khi giải quyết báo cáo:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
