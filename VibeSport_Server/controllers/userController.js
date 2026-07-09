const User = require('../models/User');
const Follow = require('../models/Follow');
const Notification = require('../models/Notification');
const Team = require('../models/Team');
const Match = require('../models/Match');
const { getPresenceFromLastSeen } = require('../utils/presence');

function formatUserPublic(user) {
  return {
    id: user._id,
    name: user.name,
    picture: user.picture,
    favoriteSport: user.favoriteSport,
    position: user.position,
    area: user.area,
    bio: user.bio,
    rating: user.rating ?? 0,
    createdAt: user.createdAt,
  };
}

async function buildUserStats(userId, storedStats = {}) {
  const matchesPlayed = await Match.countDocuments({
    participants: userId,
    status: { $in: ['open', 'full', 'completed'] },
  });

  return {
    matchesPlayed: Math.max(matchesPlayed, storedStats.matchesPlayed || 0),
    matchesWon: storedStats.matchesWon || 0,
    mvp: storedStats.mvp || 0,
    rating: storedStats.rating ?? 0,
  };
}

exports.getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.userId;

    const user = await User.findById(id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Lấy danh sách thô kết hợp xác thực sự tồn tại thực thể qua populate để loại trừ user ảo/rác
    const [followersRaw, followingRaw] = await Promise.all([
      Follow.find({ followingId: id }).populate('followerId', '_id'),
      Follow.find({ followerId: id }).populate('followingId', '_id')
    ]);

    // Chỉ tính các bản ghi mà tài khoản đối phương thực tế vẫn còn tồn tại trong cơ sở dữ liệu
    const followerCount = followersRaw.filter(f => f.followerId).length;
    const followingCount = followingRaw.filter(f => f.followingId).length;

    const followingByTarget = followingRaw.filter(f => f.followingId).map(f => f.followingId._id);

    const [isFollowing, isFollowedBy, mutualFriends] = await Promise.all([
      viewerId ? Follow.exists({ followerId: viewerId, followingId: id }) : false,
      viewerId ? Follow.exists({ followerId: id, followingId: viewerId }) : false,
      viewerId && String(viewerId) !== String(id)
        ? Follow.countDocuments({ followerId: viewerId, followingId: { $in: followingByTarget } })
        : 0,
    ]);

    const storedStats =
      user.stats && typeof user.stats.toObject === 'function'
        ? user.stats.toObject()
        : user.stats || {};

    const stats = await buildUserStats(user._id, {
      ...storedStats,
      rating: user.rating,
    });

    const presence = getPresenceFromLastSeen(user.lastSeenAt);
    const isSelf = String(viewerId) === String(id);

    res.json({
      success: true,
      data: {
        ...formatUserPublic(user),
        stats,
        followerCount,
        followingCount,
        mutualFriends,
        isFollowing: Boolean(isFollowing),
        isFollowedBy: Boolean(isFollowedBy),
        isSelf,
        presence,
        ...(isSelf ? { email: user.email, phone: user.phone } : {}),
      },
    });
  } catch (error) {
    console.error('getUserProfile error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải trang cá nhân' });
  }
};

exports.toggleFollow = async (req, res) => {
  try {
    const { id } = req.params;
    const followerId = req.userId;

    if (String(followerId) === String(id)) {
      return res.status(400).json({ success: false, message: 'Không thể theo dõi chính mình' });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const existing = await Follow.findOne({ followerId, followingId: id });

    if (existing) {
      await Follow.deleteOne({ _id: existing._id });
      const isFollowedBy = await Follow.exists({ followerId: id, followingId: followerId });
      return res.json({
        success: true,
        following: false,
        isFollowedBy: Boolean(isFollowedBy),
        message: 'Đã bỏ theo dõi',
      });
    }

    await Follow.create({ followerId, followingId: id });

    const follower = await User.findById(followerId).select('name');
    await Notification.create({
      userId: id,
      type: 'follow',
      fromUserId: followerId,
      message: `${follower?.name || 'Ai đó'} đã bắt đầu theo dõi bạn`,
    });

    const isFollowedBy = await Follow.exists({ followerId: id, followingId: followerId });

    res.json({
      success: true,
      following: true,
      isFollowedBy: Boolean(isFollowedBy),
      message: 'Đã theo dõi',
    });
  } catch (error) {
    console.error('toggleFollow error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật theo dõi' });
  }
};

exports.getUserTeams = async (req, res) => {
  try {
    const { id } = req.params;

    const teams = await Team.find({ 'members.userId': id }).sort({ updatedAt: -1 });

    const active = [];
    const past = [];

    teams.forEach((team) => {
      const membership = team.members.find((m) => String(m.userId) === String(id));
      if (!membership) return;

      const item = {
        teamId: team._id,
        name: team.name,
        logo: team.logo,
        sport: team.sport,
        role: membership.role,
        joinedAt: membership.joinedAt,
        leftAt: membership.leftAt,
      };

      if (membership.leftAt) {
        past.push(item);
      } else {
        active.push(item);
      }
    });

    res.json({
      success: true,
      data: { active, past },
    });
  } catch (error) {
    console.error('getUserTeams error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải đội bóng' });
  }
};

exports.updatePresence = async (req, res) => {
  try {
    const now = new Date();
    await User.findByIdAndUpdate(req.userId, { lastSeenAt: now });
    res.json({
      success: true,
      data: getPresenceFromLastSeen(now),
    });
  } catch (error) {
    console.error('updatePresence error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái hoạt động' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .populate('fromUserId', 'name picture')
      .sort({ createdAt: -1 })
      .limit(30);

    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải thông báo' });
  }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thông báo' });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    if (!keyword) {
      return res.json({ success: true, data: [] });
    }
    const users = await User.find({
      name: { $regex: keyword, $options: 'i' },
    })
      .select('_id name picture favoriteSport')
      .limit(8)
      .lean();

    res.json({
      success: true,
      data: users.map((u) => ({
        id: u._id,
        name: u.name,
        picture: u.picture,
        favoriteSport: u.favoriteSport,
      })),
    });
  } catch (error) {
    console.error('searchUsers error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tìm kiếm người dùng' });
  }
};

exports.getMutualFriends = async (req, res) => {
  try {
    const following = await Follow.find({ followerId: req.userId }).distinct('followingId');
    const mutualFollowers = await Follow.find({
      followerId: { $in: following },
      followingId: req.userId,
    }).populate('followerId', '_id name picture favoriteSport position area lastSeenAt');

    const friends = mutualFollowers
      .map((f) => f.followerId)
      .filter(Boolean);

    res.status(200).json({
      success: true,
      data: friends,
    });
  } catch (error) {
    console.error('getMutualFriends error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách bạn bè' });
  }
};

exports.getFollowingList = async (req, res) => {
  try {
    const targetUserId = req.params.id || req.userId;
    const viewerId = req.userId;

    const followDocs = await Follow.find({ followerId: targetUserId })
      .populate('followingId', '_id name picture favoriteSport position area lastSeenAt bio');

    const users = followDocs.map((f) => f.followingId).filter(Boolean);
    const userIds = users.map((u) => u._id);

    const [viewerFollowing, targetFollowers] = await Promise.all([
      viewerId ? Follow.find({ followerId: viewerId, followingId: { $in: userIds } }).distinct('followingId') : [],
      Follow.find({ followerId: { $in: userIds }, followingId: targetUserId }).distinct('followerId')
    ]);

    const viewerFollowingSet = new Set(viewerFollowing.map(String));
    const targetFollowersSet = new Set(targetFollowers.map(String));

    const data = users.map((user) => {
      const uIdStr = String(user._id);
      return {
        ...formatUserPublic(user),
        _id: user._id,
        isFollowing: viewerFollowingSet.has(uIdStr),
        isFollowedBy: targetFollowersSet.has(uIdStr),
      };
    });

    res.status(200).json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    console.error('getFollowingList error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách đang follow' });
  }
};

exports.getFollowersList = async (req, res) => {
  try {
    const targetUserId = req.params.id || req.userId;
    const viewerId = req.userId;

    const followDocs = await Follow.find({ followingId: targetUserId })
      .populate('followerId', '_id name picture favoriteSport position area lastSeenAt bio');

    const users = followDocs.map((f) => f.followerId).filter(Boolean);
    const userIds = users.map((u) => u._id);

    const [viewerFollowing, viewerFollowers] = await Promise.all([
      viewerId ? Follow.find({ followerId: viewerId, followingId: { $in: userIds } }).distinct('followingId') : [],
      viewerId ? Follow.find({ followerId: { $in: userIds }, followingId: viewerId }).distinct('followerId') : []
    ]);

    const viewerFollowingSet = new Set(viewerFollowing.map(String));
    const viewerFollowersSet = new Set(viewerFollowers.map(String));

    const data = users.map((user) => {
      const uIdStr = String(user._id);
      return {
        ...formatUserPublic(user),
        _id: user._id,
        isFollowing: viewerFollowingSet.has(uIdStr),
        isFollowedBy: viewerFollowersSet.has(uIdStr),
      };
    });

    res.status(200).json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    console.error('getFollowersList error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách người theo dõi' });
  }
};