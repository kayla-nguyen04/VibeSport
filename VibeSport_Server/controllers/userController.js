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

    const followingByTarget = await Follow.find({ followerId: id }).distinct('followingId');

    const [followerCount, followingCount, isFollowing, mutualFriends] = await Promise.all([
      Follow.countDocuments({ followingId: id }),
      Follow.countDocuments({ followerId: id }),
      viewerId ? Follow.exists({ followerId: viewerId, followingId: id }) : false,
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

    res.json({
      success: true,
      data: {
        ...formatUserPublic(user),
        stats,
        followerCount,
        followingCount,
        mutualFriends,
        isFollowing: Boolean(isFollowing),
        isSelf: String(viewerId) === String(id),
        presence,
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
      return res.json({
        success: true,
        following: false,
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

    res.json({
      success: true,
      following: true,
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
