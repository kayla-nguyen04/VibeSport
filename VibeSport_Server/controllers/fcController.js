const FC = require('../models/FC');
const Post = require('../models/Post');
const User = require('../models/User');

// 1. Create a new FC
exports.createFC = async (req, res) => {
  try {
    const { name, description, sportType, isPrivate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên FC là bắt buộc' });
    }

    let avatar = '';
    let coverImage = '';
    if (req.files) {
      if (req.files.avatar && req.files.avatar[0]) {
        avatar = req.files.avatar[0].path || '';
      }
      if (req.files.coverImage && req.files.coverImage[0]) {
        coverImage = req.files.coverImage[0].path || '';
      }
    }

    const fc = new FC({
      name: name.trim(),
      description: description || '',
      sportType: sportType || 'Bóng đá',
      isPrivate: isPrivate === 'true' || isPrivate === true,
      avatar,
      coverImage,
      createdBy: req.userId,
      members: [req.userId],
      pendingJoinRequests: [],
    });

    await fc.save();

    res.status(201).json({
      success: true,
      message: 'Tạo FC thành công!',
      data: fc,
    });
  } catch (error) {
    console.error('Create FC error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo FC' });
  }
};

// 2. Search FCs by name
exports.searchFC = async (req, res) => {
  try {
    const keyword = String(req.query.q || '').trim();
    const filter = {};
    if (keyword) {
      filter.name = { $regex: keyword, $options: 'i' };
    }

    const fcs = await FC.find(filter)
      .populate('createdBy', 'name picture')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: fcs,
    });
  } catch (error) {
    console.error('Search FC error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tìm kiếm FC' });
  }
};

// 3. Get FC Details & Posts
exports.getFCDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FC.findById(id)
      .populate('createdBy', 'name picture createdAt')
      .populate('members', 'name picture createdAt')
      .populate('pendingJoinRequests', 'name picture');
    if (!fc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy FC' });
    }

    const isMember = fc.members.some((m) => String(m) === String(req.userId));
    const isOwner = String(fc.createdBy._id) === String(req.userId);
    const hasPendingRequest = fc.pendingJoinRequests.some((m) => String(m._id) === String(req.userId));

    let posts = [];
    if (!fc.isPrivate || isMember || isOwner) {
      posts = await Post.find({ fcId: id, status: { $ne: 'removed_by_admin' } })
        .populate('userId', 'name picture favoriteSport')
        .populate('fcId', 'name avatar description isPrivate')
        .sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      data: {
        fc,
        posts,
        isMember,
        isOwner,
        hasPendingRequest,
        membersCount: fc.members.length,
        pendingJoinRequests: isOwner ? fc.pendingJoinRequests : [],
      },
    });
  } catch (error) {
    console.error('Get FC Details error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải thông tin FC' });
  }
};

// 4. Join an FC
exports.joinFC = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FC.findById(id);
    if (!fc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy FC' });
    }

    if (fc.members.some((m) => String(m) === String(req.userId))) {
      return res.status(400).json({ success: false, message: 'Bạn đã là thành viên của FC này' });
    }

    if (fc.isPrivate) {
      const alreadyRequested = fc.pendingJoinRequests.some((m) => String(m) === String(req.userId));
      if (alreadyRequested) {
        return res.status(200).json({ success: true, message: 'Bạn đã gửi yêu cầu tham gia FC, vui lòng chờ chủ FC chấp nhận.' });
      }
      fc.pendingJoinRequests.push(req.userId);
      await fc.save();

      return res.status(200).json({
        success: true,
        message: 'Yêu cầu tham gia FC đã được gửi. Vui lòng chờ chủ FC chấp nhận.',
      });
    }

    fc.members.push(req.userId);
    await fc.save();

    res.status(200).json({
      success: true,
      message: 'Tham gia FC thành công!',
      data: { membersCount: fc.members.length },
    });
  } catch (error) {
    console.error('Join FC error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tham gia FC' });
  }
};

// 5. Approve a pending join request for a private FC
exports.approveJoinRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const fc = await FC.findById(id);
    if (!fc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy FC' });
    }

    if (String(fc.createdBy) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ chủ FC mới có thể duyệt yêu cầu.' });
    }

    const requestIndex = fc.pendingJoinRequests.findIndex((m) => String(m) === String(userId));
    if (requestIndex === -1) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy yêu cầu tham gia.' });
    }

    const alreadyMember = fc.members.some((m) => String(m) === String(userId));
    if (!alreadyMember) {
      fc.members.push(userId);
    }
    fc.pendingJoinRequests.splice(requestIndex, 1);
    await fc.save();

    res.status(200).json({
      success: true,
      message: 'Đã chấp nhận yêu cầu tham gia FC.',
    });
  } catch (error) {
    console.error('Approve join request error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi duyệt yêu cầu tham gia FC' });
  }
};

// 6. Leave an FC
exports.leaveFC = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FC.findById(id);
    if (!fc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy FC' });
    }

    const index = fc.members.findIndex((m) => String(m) === String(req.userId));
    if (index === -1) {
      return res.status(400).json({ success: false, message: 'Bạn chưa tham gia FC này' });
    }

    fc.members.splice(index, 1);
    await fc.save();

    res.status(200).json({
      success: true,
      message: 'Rút khỏi FC thành công!',
      data: { membersCount: fc.members.length },
    });
  } catch (error) {
    console.error('Leave FC error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi rời FC' });
  }
};

// 7. Update an FC
exports.updateFC = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sportType, isPrivate } = req.body;
    const fc = await FC.findById(id);
    if (!fc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy FC' });
    }

    if (String(fc.createdBy) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ chủ FC mới có thể chỉnh sửa' });
    }

    if (name) fc.name = name.trim();
    if (description !== undefined) fc.description = description;
    if (sportType) fc.sportType = sportType;
    if (isPrivate !== undefined) {
      fc.isPrivate = isPrivate === 'true' || isPrivate === true;
    }

    if (req.files) {
      if (req.files.avatar && req.files.avatar[0]) {
        fc.avatar = req.files.avatar[0].path || '';
      }
      if (req.files.coverImage && req.files.coverImage[0]) {
        fc.coverImage = req.files.coverImage[0].path || '';
      }
    }

    await fc.save();
    res.status(200).json({ success: true, message: 'Cập nhật FC thành công!', data: fc });
  } catch (error) {
    console.error('Update FC error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật FC' });
  }
};

// 8. Delete an FC
exports.deleteFC = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FC.findById(id);
    if (!fc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy FC' });
    }

    if (String(fc.createdBy) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ chủ FC mới có thể xóa FC' });
    }

    // Delete all posts belonging to this FC
    await Post.deleteMany({ fcId: id });
    await FC.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: 'Xóa FC thành công!' });
  } catch (error) {
    console.error('Delete FC error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa FC' });
  }
};
