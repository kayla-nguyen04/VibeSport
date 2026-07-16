const Post = require('../models/Post');
const Notification = require('../models/Notification');
const ModerationLog = require('../models/ModerationLog');
const Report = require('../models/Report');
const User = require('../models/User');
const { incrementReportCount, decrementReportCount } = require('../utils/reportHelpers');

// ─── Helper: gửi thông báo vi phạm cho user (non-blocking) ───
async function notifyUserViolation(userId, postId, reason, category) {
  try {
    const post = await Post.findById(postId).lean();
    if (!post) return;

    const user = await User.findById(userId).select('name').lean();
    const userName = user?.name || 'Người dùng';

    // Tạo preview nội dung (tối đa 50 ký tự)
    const contentPreview = post.content?.length > 50
      ? post.content.substring(0, 50) + '...'
      : post.content || 'Không có nội dung';

    const categoryLabel = {
      'spam': 'Spam',
      'ngôn từ thù ghét': 'Ngôn từ thù ghét',
      'nội dung không phù hợp': 'Nội dung không phù hợp',
      'vi phạm bản quyền': 'Vi phạm bản quyền',
      'other': 'Vi phạm khác',
    }[category] || 'Vi phạm';

    const message = `Bài viết "${contentPreview}" đã bị gỡ vì ${categoryLabel}. Lý do: ${reason}`;

    const notification = new Notification({
      userId,
      type: 'violation_removed',
      fromUserId: null, // từ hệ thống
      message,
      postId,
    });
    await notification.save();

    // Emit socket notification nếu có
    if (global.io) {
      const populated = await Notification.findById(notification._id)
        .populate('postId', 'content mediaUrls');

      global.io.to(userId.toString()).emit('new_notification', populated);

      const unreadCount = await Notification.countDocuments({
        userId,
        read: false,
        type: { $ne: 'message' },
      });
      global.io.to(userId.toString()).emit('unread_count', { unreadCount });
    }
  } catch (error) {
    console.error('[Admin] Error sending violation notification:', error);
  }
}

// ─── Helper: gửi thông báo khôi phục cho user (non-blocking) ───
async function notifyUserRestore(userId, postId) {
  try {
    const post = await Post.findById(postId).lean();
    if (!post) return;

    const contentPreview = post.content?.length > 50
      ? post.content.substring(0, 50) + '...'
      : post.content || 'Không có nội dung';

    const message = `Bài viết "${contentPreview}" đã được khôi phục và hiển thị trở lại.`;

    const notification = new Notification({
      userId,
      type: 'post_restored',
      fromUserId: null,
      message,
      postId,
    });
    await notification.save();

    if (global.io) {
      const populated = await Notification.findById(notification._id)
        .populate('postId', 'content mediaUrls');

      global.io.to(userId.toString()).emit('new_notification', populated);

      const unreadCount = await Notification.countDocuments({
        userId,
        read: false,
        type: { $ne: 'message' },
      });
      global.io.to(userId.toString()).emit('unread_count', { unreadCount });
    }
  } catch (error) {
    console.error('[Admin] Error sending restore notification:', error);
  }
}

// ─── 1. Xóa nội dung vi phạm ───
exports.removePostViolation = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason, category } = req.body;

    // Validation
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lý do xóa là bắt buộc',
      });
    }

    const validCategories = ['spam', 'ngôn từ thù ghét', 'nội dung không phù hợp', 'vi phạm bản quyền', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Danh mục vi phạm không hợp lệ',
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết',
      });
    }

    // Kiểm tra đã bị xóa chưa
    if (post.status === 'removed_by_admin') {
      return res.status(400).json({
        success: false,
        message: 'Bài viết đã bị gỡ trước đó',
      });
    }

    const previousStatus = post.status;
    const adminId = req.admin._id;

    // Update post - soft delete
    post.status = 'removed_by_admin';
    post.removalReason = reason.trim();
    post.removalCategory = category;
    post.removedBy = adminId;
    post.removedAt = new Date();
    await post.save();

    // Ghi log vào ModerationLog
    await ModerationLog.create({
      postId: post._id,
      adminId,
      userId: post.userId,
      reason: reason.trim(),
      category,
      action: 'removed',
      previousStatus,
      newStatus: 'removed_by_admin',
    });

    // Gửi thông báo cho user (non-blocking)
    notifyUserViolation(post.userId, post._id, reason.trim(), category);

    // Đánh dấu tất cả report liên quan là đã xử lý
    await Report.updateMany({ postId: post._id, status: 'pending' }, { status: 'reviewed' });

    res.status(200).json({
      success: true,
      message: 'Đã gỡ bài viết thành công',
      data: {
        postId: post._id,
        status: post.status,
        removalReason: post.removalReason,
        removalCategory: post.removalCategory,
        removedAt: post.removedAt,
      },
    });
  } catch (error) {
    console.error('Remove post violation error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gỡ bài viết',
    });
  }
};

// ─── 2. Khôi phục bài viết ───
exports.restorePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết',
      });
    }

    if (post.status !== 'removed_by_admin') {
      return res.status(400).json({
        success: false,
        message: 'Bài viết không ở trạng thái bị gỡ',
      });
    }

    const previousStatus = post.status;
    const adminId = req.admin._id;

    // Restore post
    post.status = 'active';
    post.removalReason = null;
    post.removalCategory = null;
    post.removedBy = null;
    post.removedAt = null;
    await post.save();

    // Ghi log
    await ModerationLog.create({
      postId: post._id,
      adminId,
      userId: post.userId,
      reason: 'Khôi phục bài viết',
      category: 'other',
      action: 'restored',
      previousStatus,
      newStatus: 'active',
    });

    // Gửi thông báo cho user (non-blocking)
    notifyUserRestore(post.userId, post._id);

    // Đánh dấu tất cả report liên quan là đã xử lý
    await Report.updateMany({ postId: post._id, status: 'pending' }, { status: 'reviewed' });

    res.status(200).json({
      success: true,
      message: 'Đã khôi phục bài viết',
      data: {
        postId: post._id,
        status: post.status,
      },
    });
  } catch (error) {
    console.error('Restore post error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi khôi phục bài viết',
    });
  }
};

// ─── 3. Lấy danh sách bài viết (admin) ───
exports.getAdminPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const order = req.query.order === 'asc' ? 1 : -1;
    const status = req.query.status;

    // Validate sortBy
    const validSortFields = ['createdAt', 'reportCount', 'likesCount', 'commentsCount'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const pipeline = [
      // 1. Filter theo status
      ...(status && status !== 'all'
        ? [
            status === 'reported'
              ? { $match: { status: 'active', hasPendingReports: true } }
              : status === 'removed'
                ? { $match: { status: 'removed_by_admin' } }
                : status === 'pending_review'
                  ? { $match: { status: 'pending_review' } }
                  : status === 'resolved'
                    ? { $match: { $or: [{ status: 'hidden' }, { status: 'active', hasPendingReports: false }] } }
                    : { $match: { status } },
          ]
        : [{ $match: {} }]),
      // 2. Lookup reports để kiểm tra pending
      {
        $lookup: {
          from: 'reports',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$postId', '$$postId'] },
                status: 'pending',
              },
            },
            { $limit: 1 },
          ],
          as: 'pendingReportsLookup',
        },
      },
      // 3. Thêm hasPendingReports
      {
        $addFields: {
          hasPendingReports: { $gt: [{ $size: '$pendingReportsLookup' }, 0] },
        },
      },
      // 4. Bỏ field tạm
      { $project: { pendingReportsLookup: 0 } },
    ];

    const countPipeline = [...pipeline, { $count: 'total' }];

    const [posts, countResult] = await Promise.all([
      Post.aggregate([...pipeline, { $sort: { [sortField]: order, createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
      Post.aggregate(countPipeline),
    ]);

    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Populate userId và removedBy sau aggregate
    const userIds = [...new Set(posts.map(p => p.userId).filter(Boolean))];
    const removedByIds = [...new Set(posts.map(p => p.removedBy).filter(Boolean))];
    const [users, removedBies] = await Promise.all([
      userIds.length ? User.find({ _id: { $in: userIds } }).select('name picture').lean() : [],
      removedByIds.length ? User.find({ _id: { $in: removedByIds } }).select('name email').lean() : [],
    ]);
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const removedByMap = Object.fromEntries(removedBies.map(u => [u._id.toString(), u]));
    const enrichedPosts = posts.map(p => ({
      ...p,
      userId: userMap[p.userId?.toString()] || p.userId,
      removedBy: removedByMap[p.removedBy?.toString()] || p.removedBy,
    }));

    res.status(200).json({
      success: true,
      data: enrichedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get admin posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách bài viết',
    });
  }
};

// ─── 4. Lấy chi tiết bài viết (admin) ───
exports.getAdminPostById = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId)
      .populate('userId', 'name picture email')
      .populate('removedBy', 'name email');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết',
      });
    }

    // Lấy log moderation
    const moderationLogs = await ModerationLog.find({ postId })
      .populate('adminId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Lấy các báo cáo gần nhất (mới nhất trước), populate reporterId
    const recentReports = await Report.find({ postId })
      .populate('reporterId', 'name picture')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...post.toObject(),
        moderationLogs,
        recentReports,
      },
    });
  } catch (error) {
    console.error('Get admin post by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết bài viết',
    });
  }
};

// ─── 5. Lấy lịch sử moderation ───
exports.getModerationLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      ModerationLog.find()
        .populate('postId', 'content mediaUrls')
        .populate('adminId', 'name email')
        .populate('userId', 'name picture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ModerationLog.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get moderation logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử moderation',
    });
  }
};

// ─── 6. Thêm/sửa report count (endpoint nội bộ cho user report) ───
exports.updateReportCount = async (req, res) => {
  try {
    const { postId } = req.params;
    const { action } = req.body; // 'increment' | 'decrement'

    let post;
    if (action === 'increment') {
      post = await incrementReportCount(postId);
    } else if (action === 'decrement') {
      post = await decrementReportCount(postId);
    } else {
      return res.status(400).json({ success: false, message: 'Action không hợp lệ' });
    }

    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    res.status(200).json({
      success: true,
      data: {
        reportCount: post.reportCount,
        status: post.status,
      },
    });
  } catch (error) {
    console.error('Update report count error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật số báo cáo',
    });
  }
};
