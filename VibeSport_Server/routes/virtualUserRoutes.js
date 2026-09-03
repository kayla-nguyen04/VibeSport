const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const VirtualUser = require('../models/VirtualUser');
const Match = require('../models/Match');

const populateFields = [
  { path: "createdBy", select: "name avatar picture phone email rating stats" },
  { path: "participants", select: "name avatar picture phone email rating isVirtual stats" },
  { path: "pendingJoinRequests", select: "name avatar picture phone email rating stats" },
  { path: "invitedMembers", select: "name avatar picture phone email rating stats" },
  { path: "contactAppUser", select: "name avatar picture phone email" },
];

const populateMatchVirtualUsers = async (matchDoc) => {
  if (!matchDoc) return matchDoc;
  const matchObj = typeof matchDoc.toObject === 'function' ? matchDoc.toObject() : matchDoc;
  if (!Array.isArray(matchObj.participants)) return matchObj;

  const participantIds = matchObj.participants
    .map(p => typeof p === 'object' ? String(p._id || p.id) : String(p))
    .filter(Boolean);

  if (participantIds.length > 0) {
    const [vUsers, userVirtuals] = await Promise.all([
      VirtualUser.find({ _id: { $in: participantIds } }).lean(),
      User.find({ _id: { $in: participantIds }, isVirtual: true }).lean(),
    ]);

    const vMap = new Map();
    vUsers.forEach(v => vMap.set(String(v._id), { ...v, isVirtual: true }));
    userVirtuals.forEach(v => vMap.set(String(v._id), { ...v, isVirtual: true }));

    matchObj.participants = matchObj.participants.map(p => {
      const pid = typeof p === 'object' ? String(p._id || p.id) : String(p);
      const v = vMap.get(pid);
      if (v) {
        return {
          ...(typeof p === 'object' ? p : {}),
          ...v,
          _id: v._id,
          id: v._id,
          name: v.name,
          picture: v.picture || v.avatar || null,
          isVirtual: true,
        };
      }
      return p;
    });
  }
  return matchObj;
};

router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { name, picture } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên tài khoản ảo không được để trống' });
    }

    const cleanName = name.trim();
    const virtualEmail = `virtual_${Date.now()}_${Math.floor(Math.random() * 10000)}@virtual.vibesport.com`;

    const virtualUser = await VirtualUser.create({
      name: cleanName,
      email: virtualEmail,
      picture: picture || null,
      isVirtual: true,
      createdByUser: userId,
      rating: 5.0,
      totalReviews: 0,
      stats: { matchesPlayed: 0, matchesWon: 0, mvp: 0 },
    });

    await User.create({
      _id: virtualUser._id,
      name: cleanName,
      email: virtualEmail,
      password: 'virtual_account_no_login',
      picture: picture || null,
      isVirtual: true,
      createdByUser: userId,
      rating: 5.0,
      stats: { matchesPlayed: 0, matchesWon: 0, mvp: 0 },
      profileCompleted: true,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Tạo tài khoản ảo thành công',
      data: virtualUser,
    });
  } catch (error) {
    console.error('Create virtual user error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo tài khoản ảo' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const virtualUsers = await VirtualUser.find({ createdByUser: userId })
      .select('name picture rating isVirtual stats createdAt')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: virtualUsers,
    });
  } catch (error) {
    console.error('Get virtual users error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách tài khoản ảo' });
  }
});

router.post('/add-to-match/:matchId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { virtualUserId } = req.body;
    const { matchId } = req.params;

    if (!virtualUserId) {
      return res.status(400).json({ success: false, message: 'Thiếu ID tài khoản ảo' });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trận đấu' });
    }

    const creatorId = match.createdBy ? (typeof match.createdBy === 'object' ? (match.createdBy._id || match.createdBy.id) : match.createdBy) : null;
    const ownerEntry = Array.isArray(match.memberRoles)
      ? match.memberRoles.find((entry) => entry?.role === 'owner')
      : null;
    const actualOwnerId = ownerEntry?.userId || creatorId;

    if (!userId || String(userId) !== String(actualOwnerId)) {
      return res.status(403).json({ success: false, message: 'Chỉ chủ trận mới có quyền thêm tài khoản ảo vào trận' });
    }

    const vUser = await VirtualUser.findById(virtualUserId);
    if (!vUser) {
      return res.status(400).json({ success: false, message: 'Tài khoản ảo không hợp lệ' });
    }

    const isAlreadyIn = match.participants.some((p) => String(p._id || p) === String(virtualUserId));
    if (isAlreadyIn) {
      return res.status(400).json({ success: false, message: 'Tài khoản ảo đã ở trong trận đấu này rồi' });
    }

    match.participants.push(virtualUserId);

    if (!match.memberPositions) match.memberPositions = [];
    if (!match.memberPositions.some((mp) => String(mp.userId) === String(virtualUserId))) {
      match.memberPositions.push({ userId: virtualUserId, positionId: '' });
    }

    await match.save();

    const updated = await Match.findById(match._id).populate(populateFields);
    const populatedWithVirtuals = await populateMatchVirtualUsers(updated);

    return res.json({
      success: true,
      message: `Đã thêm tài khoản ảo "${vUser.name}" vào trận đấu!`,
      data: populatedWithVirtuals,
    });
  } catch (error) {
    console.error('Add virtual user to match error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thêm tài khoản ảo vào trận' });
  }
});

router.delete('/:virtualUserId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { virtualUserId } = req.params;

    const vUser = await VirtualUser.findById(virtualUserId);
    if (!vUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản ảo' });
    }

    if (String(vUser.createdByUser) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa tài khoản ảo này' });
    }

    // Remove virtual user from any active matches
    await Match.updateMany(
      { participants: virtualUserId },
      {
        $pull: {
          participants: virtualUserId,
          memberRoles: { userId: virtualUserId },
          memberPositions: { userId: virtualUserId },
        },
      }
    );

    await VirtualUser.findByIdAndDelete(virtualUserId);

    return res.json({
      success: true,
      message: `Đã xóa tài khoản ảo "${vUser.name}" thành công!`,
    });
  } catch (error) {
    console.error('Delete virtual user error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa tài khoản ảo' });
  }
});

module.exports = router;
