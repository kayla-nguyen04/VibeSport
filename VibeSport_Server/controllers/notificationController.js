const Notification = require('../models/Notification');

// 1. Get notifications (paginated)
exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({
      userId: req.userId,
      type: { $ne: 'message' },
    })
      .populate('fromUserId', 'name picture')
      .populate('postId', 'content mediaUrls')
      .populate('conversationId', 'lastMessage lastMessageAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: notifications,
      page,
      limit,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách thông báo' });
  }
};

// 2. Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.userId,
      read: false,
      type: { $ne: 'message' },
    });

    res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy số thông báo chưa đọc' });
  }
};

// 3. Mark single notification as read
exports.markOneRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi đánh dấu thông báo đã đọc' });
  }
};

// 4. Mark all notifications as read
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu đọc toàn bộ thông báo',
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi đánh dấu tất cả đã đọc' });
  }
};
