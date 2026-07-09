const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Follow = require('../models/Follow');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { API_BASE_URL } = require('../utils/config');

const USER_SELECT = 'name picture area favoriteSport lastSeenAt';
const MAX_PENDING_PER_USER = 3;

function buildParticipantKey(userIdA, userIdB) {
  return [String(userIdA), String(userIdB)].sort().join('_');
}

function getUnreadCount(conversation, userId) {
  const key = String(userId);
  return Number(conversation.unreadByUser?.[key] || 0);
}

function setUnreadCount(conversation, userId, count) {
  const key = String(userId);
  if (!conversation.unreadByUser || typeof conversation.unreadByUser !== 'object') {
    conversation.unreadByUser = {};
  }
  conversation.unreadByUser[key] = Math.max(0, count);
  conversation.markModified('unreadByUser');
}

async function areMutualFriends(userIdA, userIdB) {
  const [aFollowsB, bFollowsA] = await Promise.all([
    Follow.exists({ followerId: userIdA, followingId: userIdB }),
    Follow.exists({ followerId: userIdB, followingId: userIdA }),
  ]);
  return Boolean(aFollowsB && bFollowsA);
}

async function activateConversationIfFriends(conversation) {
  const [userA, userB] = conversation.participants;
  const isFriend = await areMutualFriends(userA, userB);
  if (isFriend && conversation.status !== 'active') {
    const pendingMessages = [...(conversation.pendingMessages || [])];
    if (pendingMessages.length > 0) {
      const messagesToCreate = pendingMessages.map((msg) => ({
        conversationId: conversation._id,
        senderId: msg.senderId,
        content: msg.content,
        readBy: [userA._id, userB._id],
        createdAt: msg.createdAt,
      }));
      await Message.insertMany(messagesToCreate);
    }

    // Add both users to acceptedBy when they become friends
    const acceptedByIds = (conversation.acceptedBy || []).map((id) => String(id._id || id));
    if (!acceptedByIds.includes(String(userA._id))) {
      conversation.acceptedBy.push(userA._id);
    }
    if (!acceptedByIds.includes(String(userB._id))) {
      conversation.acceptedBy.push(userB._id);
    }

    conversation.status = 'active';
    conversation.pendingMessages = [];
    await conversation.save();
  }
  return isFriend;
}

async function getTotalUnreadCount(userId) {
  const conversations = await Conversation.find({ participants: userId }).select('unreadByUser');
  return conversations.reduce((sum, conversation) => sum + getUnreadCount(conversation, userId), 0);
}

async function emitChatUnreadCount(userId) {
  if (!global.io) return;
  const unreadCount = await getTotalUnreadCount(userId);
  global.io.to(String(userId)).emit('unread_messages_count', { unreadCount });
}

function countPendingByUser(conversation, userId) {
  return (conversation.pendingMessages || []).filter(
    (msg) => String(msg.senderId?._id || msg.senderId) === String(userId)
  ).length;
}

function isBlockedByMe(conversation, userId) {
  return (
    conversation.blockedByUserId &&
    String(conversation.blockedByUserId) === String(userId)
  );
}

function isBlockedByOther(conversation, userId) {
  const peer = conversation.participants.find(
    (p) => String(p._id || p) !== String(userId)
  );
  if (!peer) return false;
  const peerId = String(peer._id || peer);
  return (
    conversation.blockedByUserId &&
    String(conversation.blockedByUserId) === peerId
  );
}

function isCreator(conversation, userId) {
  const uid = String(userId);
  const adminId = conversation.admin ? String(conversation.admin._id || conversation.admin) : String(conversation.participants[0]?._id || conversation.participants[0]);
  return uid === adminId;
}

function isAdmin(conversation, userId) {
  if (isCreator(conversation, userId)) return true;
  return (conversation.coAdmins || []).some(id => String(id._id || id) === String(userId));
}

function isAdminOrCoAdmin(conversation, userId) {
  return isAdmin(conversation, userId);
}

function formatConversation(conversation, currentUserId, isFriend) {
  const isGroup = conversation.isGroup || conversation.participants.length > 2;

  // Filter other participants
  const otherParticipants = conversation.participants.filter(
    (participant) => String(participant._id || participant) !== String(currentUserId)
  );

  const peer = otherParticipants[0];

  const currentId = String(currentUserId);
  const acceptedBy = conversation.acceptedBy || [];
  const hasAccepted = acceptedBy.some((id) => String(id._id || id) === currentId);

  const deletedAt = conversation.deletedAtByUser?.[currentId];
  const lastMessageDeleted = deletedAt && conversation.lastMessageAt && new Date(conversation.lastMessageAt) <= new Date(deletedAt);

  const lastMessage = lastMessageDeleted ? '' : (conversation.lastMessage || '');
  const unreadCount = lastMessageDeleted ? 0 : getUnreadCount(conversation, currentUserId);

  const allPending = (conversation.pendingMessages || []).filter(
    (msg) => !deletedAt || new Date(msg.createdAt) > new Date(deletedAt)
  );

  const myPendingCount = allPending.filter(
    (msg) => String(msg.senderId?._id || msg.senderId) === currentId
  ).length;
  const remainingPending = Math.max(0, MAX_PENDING_PER_USER - myPendingCount);
  const otherPendingMessages = allPending.filter(
    (msg) => String(msg.senderId?._id || msg.senderId) !== currentId
  );

  const isMyPendingRequest = myPendingCount > 0;
  const hasOtherPendingRequest = otherPendingMessages.length > 0;

  const blockedByMe = isBlockedByMe(conversation, currentUserId);
  const blockedByOther = isBlockedByOther(conversation, currentUserId);
  const isBlocked = blockedByMe || blockedByOther;

  const deletedByMe = (conversation.deletedByUserIds || []).some(
    (id) => String(id._id || id) === currentId
  );
  const isMuted = (conversation.mutedByUserIds || []).some(
    (id) => String(id._id || id) === currentId
  );
  const isHidden = deletedByMe;

  let viewState = 'inbox';
  if (!isGroup) {
    if (isBlocked) {
      viewState = 'blocked';
    } else if (!hasAccepted && hasOtherPendingRequest) {
      viewState = 'request';
    }
  }

  const canChat = (isGroup && !(conversation.mutedMembers || []).some(id => String(id._id || id) === currentId)) || (!isGroup && (isFriend || hasAccepted) && !blockedByOther);
  const canSendPending = !isGroup && (remainingPending > 0 && !isHidden && !isBlocked);

  // Group display name defaults to comma-separated list of names of other participants
  let displayName = conversation.name;
  if (!displayName && isGroup) {
    displayName = otherParticipants.map(p => p.name).filter(Boolean).join(', ');
  }

  return {
    _id: conversation._id,
    isGroup,
    name: conversation.name || '',
    participants: conversation.participants,
    peer: peer
      ? {
          _id: peer._id,
          name: displayName || peer.name || 'Thành viên VibeSport',
          picture: isGroup ? (conversation.avatar || '') : peer.picture, // group avatar or fallback
          area: peer.area,
          favoriteSport: peer.favoriteSport,
          lastSeenAt: peer.lastSeenAt,
        }
      : null,
    lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount,
    updatedAt: conversation.updatedAt,
    status: conversation.status,
    isFriend: Boolean(isGroup || isFriend),
    isPending: !isGroup && (!hasAccepted && hasOtherPendingRequest),
    isMyPendingRequest: !isGroup && isMyPendingRequest,
    hasOtherPendingRequest: !isGroup && hasOtherPendingRequest,
    myPendingCount: !isGroup ? myPendingCount : 0,
    remainingPendingMessages: !isGroup ? remainingPending : 0,
    otherPendingMessages: !isGroup ? otherPendingMessages : [],
    pendingMessages: !isGroup ? allPending : [],
    blockedByMe: !isGroup && blockedByMe,
    blockedByOther: !isGroup && blockedByOther,
    isBlocked: !isGroup && isBlocked,
    viewState,
    deletedByMe,
    isHidden,
    isMuted,
    canChat,
    canSendPending,
    hasAccepted,
    // Group permission fields
    admin: conversation.admin || (isGroup ? conversation.participants[0]?._id : null),
    coAdmins: conversation.coAdmins || [],
    mutedMembers: conversation.mutedMembers || [],
    isAdmin: isGroup ? isCreator(conversation, currentUserId) : false,
    isCoAdmin: isGroup ? (conversation.coAdmins || []).some(id => String(id._id || id) === currentId) : false,
    isAdminOrCoAdmin: isGroup ? isAdmin(conversation, currentUserId) : false,
    isMutedMember: isGroup ? (conversation.mutedMembers || []).some(id => String(id._id || id) === currentId) : false,
    // Nickname fields
    nicknames: conversation.nicknames || {},
    // Invite link fields
    inviteCode: isGroup && isAdminOrCoAdmin(conversation, currentUserId) ? (conversation.inviteCode || null) : null,
    inviteLinkEnabled: isGroup ? (conversation.inviteLinkEnabled || false) : false,
    // Join requests: chỉ hiện cho admin/co-admin
    joinRequests: isGroup && isAdminOrCoAdmin(conversation, currentUserId)
      ? (conversation.joinRequests || [])
      : [],
    // Added-by tracking: chỉ hiện cho admin/co-admin
    addedBy: isGroup && isAdminOrCoAdmin(conversation, currentUserId)
      ? (conversation.addedBy || {})
      : {},
    pinnedMessages: conversation.pinnedMessages || [],
  };
}

exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId })
      .populate('participants', USER_SELECT)
      .populate('pendingMessages.senderId', USER_SELECT)
      .populate('joinRequests.userId', USER_SELECT)
      .sort({ lastMessageAt: -1 });

    const formatted = await Promise.all(
      conversations.map(async (conversation) => {
        const isFriend = await activateConversationIfFriends(conversation);
        return formatConversation(conversation, req.userId, isFriend);
      })
    );

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách hội thoại' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await getTotalUnreadCount(req.userId);
    res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    console.error('Get chat unread count error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy số tin nhắn chưa đọc' });
  }
};

exports.createOrGetConversation = async (req, res) => {
  try {
    const { recipientId, recipientIds, name } = req.body;

    let targetIds = [];
    if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
      targetIds = recipientIds;
    } else if (recipientId) {
      targetIds = [recipientId];
    } else {
      return res.status(400).json({ success: false, message: 'Thiếu người nhận' });
    }

    // Filter distinct recipient IDs and exclude current user ID
    const uniqueIds = [...new Set(targetIds.map((id) => String(id)))].filter(
      (id) => id !== String(req.userId)
    );

    if (uniqueIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách người nhận không hợp lệ' });
    }

    const isGroup = uniqueIds.length > 1;

    // Check that all recipients exist
    const recipients = await User.find({ _id: { $in: uniqueIds } }).select(USER_SELECT);
    if (recipients.length !== uniqueIds.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy một hoặc nhiều người dùng' });
    }

    const allParticipants = [req.userId, ...uniqueIds];
    const participantKey = isGroup
      ? `group_${new mongoose.Types.ObjectId()}`
      : allParticipants.map((id) => String(id)).sort().join('_');

    let conversation = null;
    if (!isGroup) {
      conversation = await Conversation.findOne({ participantKey }).populate('participants', USER_SELECT);
    }

    if (!conversation) {
      let status = 'active';
      if (!isGroup) {
        const isFriend = await areMutualFriends(req.userId, uniqueIds[0]);
        status = isFriend ? 'active' : 'pending';
      }

      const unreadByUser = {};
      allParticipants.forEach((id) => {
        unreadByUser[String(id)] = 0;
      });

      conversation = await Conversation.create({
        participants: allParticipants,
        participantKey,
        status,
        name: isGroup ? (name || '') : '',
        isGroup,
        unreadByUser,
        acceptedBy: isGroup ? allParticipants : [req.userId],
        admin: isGroup ? req.userId : null,
      });
      conversation = await Conversation.findById(conversation._id).populate('participants', USER_SELECT);
    } else {
      let needsSave = false;
      if (!isGroup) {
        const isFriend = await areMutualFriends(req.userId, uniqueIds[0]);
        if (isFriend && conversation.status !== 'active') {
          conversation.status = 'active';
          conversation.pendingMessages = [];
          needsSave = true;
        }
      }

      // Khôi phục hội thoại nếu đã bị xoá trước đó
      const userIdStr = String(req.userId);
      const originalLength = (conversation.deletedByUserIds || []).length;
      conversation.deletedByUserIds = (conversation.deletedByUserIds || []).filter(
        (id) => String(id) !== userIdStr
      );
      if ((conversation.deletedByUserIds || []).length !== originalLength) {
        conversation.markModified('deletedByUserIds');
        needsSave = true;
      }

      if (needsSave) {
        await conversation.save();
        conversation = await Conversation.findById(conversation._id).populate('participants', USER_SELECT);
      }
    }

    const isFriend = !isGroup ? await areMutualFriends(req.userId, uniqueIds[0]) : true;

    res.status(200).json({
      success: true,
      data: formatConversation(conversation, req.userId, isFriend),
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo hội thoại' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const skip = (page - 1) * limit;

    const conversation = await Conversation.findById(id);
    if (
      !conversation ||
      !conversation.participants.some(
        (participantId) => String(participantId) === String(req.userId)
      )
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    const query = { conversationId: id };
    const deletedAt = conversation.deletedAtByUser?.[req.userId];
    if (deletedAt) {
      query.createdAt = { $gt: new Date(deletedAt) };
    }

    const messages = await Message.find(query)
      .populate('senderId', USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const isFriend = await activateConversationIfFriends(conversation);

    res.status(200).json({
      success: true,
      data: messages.reverse(),
      page,
      limit,
      hasMore: messages.length === limit,
      conversation: formatConversation(
        await Conversation.findById(id)
          .populate('participants', USER_SELECT)
          .populate('pendingMessages.senderId', USER_SELECT),
        req.userId,
        isFriend
      ),
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy tin nhắn' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const trimmedContent = String(content || '').trim();

    if (!trimmedContent) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống',
      });
    }

    const conversation = await Conversation.findById(id);
    if (
      !conversation ||
      !conversation.participants.some(
        (participantId) => String(participantId) === String(req.userId)
      )
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    const isGroup = conversation.isGroup || conversation.participants.length > 2;

    // Check if user is muted in group
    if (isGroup && (conversation.mutedMembers || []).some(id => String(id) === String(req.userId))) {
      return res.status(403).json({
        success: false,
        message: 'Bạn đã bị cấm chat trong nhóm này',
      });
    }

    const isBlocked = !isGroup && isBlockedByMe(conversation, req.userId);

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Bạn đã chặn cuộc trò chuyện này',
      });
    }

    const otherParticipants = conversation.participants.filter(
      (participantId) => String(participantId) !== String(req.userId)
    );

    if (otherParticipants.length === 0) {
      return res.status(400).json({ success: false, message: 'Hội thoại không hợp lệ' });
    }

    const recipientId = otherParticipants[0];
    const isFriend = !isGroup ? await areMutualFriends(req.userId, recipientId) : true;

    if (!isGroup && (conversation.status === 'active' || isFriend)) {
      conversation.status = 'active';
    }

    if (!isGroup && conversation.status === 'pending') {
      if (isBlockedByMe(conversation, recipientId)) {
        return res.status(403).json({
          success: false,
          message: 'Bạn đã chặn người này',
        });
      }

      // Check if user has already accepted (via auto-accept or manual accept)
      const acceptedByIds = (conversation.acceptedBy || []).map((id) => String(id._id || id));
      const hasAccepted = acceptedByIds.includes(String(req.userId));

      // If user has accepted, they can send directly to Messages collection
      if (hasAccepted) {
        const message = await Message.create({
          conversationId: id,
          senderId: req.userId,
          content: trimmedContent,
          readBy: [req.userId],
        });

        conversation.lastMessage = trimmedContent;
        conversation.lastMessageAt = message.createdAt;
        setUnreadCount(conversation, req.userId, 0);
        setUnreadCount(conversation, recipientId, getUnreadCount(conversation, recipientId) + 1);
        conversation.deletedByUserIds = [];
        conversation.markModified('deletedByUserIds');
        await conversation.save();

        const populatedMessage = await Message.findById(message._id).populate('senderId', USER_SELECT);
        const formattedConversation = formatConversation(
          await Conversation.findById(id).populate('participants', USER_SELECT),
          req.userId,
          isFriend
        );

        if (global.io) {
          global.io.to(String(recipientId)).emit('new_message', {
            conversationId: id,
            message: populatedMessage,
            lastMessage: trimmedContent,
            lastMessageAt: conversation.lastMessageAt,
            conversation: formatConversation(
              await Conversation.findById(id).populate('participants', USER_SELECT),
              recipientId,
              isFriend
            ),
          });
          await emitChatUnreadCount(recipientId);
        }

        res.status(201).json({
          success: true,
          data: populatedMessage,
          conversation: formattedConversation,
        });
        return;
      }

      // User hasn't accepted yet - messages go to pendingMessages for hybrid system
      const myPendingCount = countPendingByUser(conversation, req.userId);
      if (myPendingCount >= MAX_PENDING_PER_USER) {
        return res.status(400).json({
          success: false,
          message: `Bạn chỉ có thể gửi tối đa ${MAX_PENDING_PER_USER} tin nhắn chờ`,
        });
      }

      // Auto-accept: add sender to acceptedBy so they see Inbox, not Request
      conversation.acceptedBy.push(req.userId);

      conversation.pendingMessages.push({
        senderId: req.userId,
        content: trimmedContent,
        createdAt: new Date(),
      });
      conversation.lastMessage = trimmedContent;
      conversation.lastMessageAt = new Date();
      conversation.deletedByUserIds = [];
      conversation.markModified('deletedByUserIds');
      await conversation.save();

      const formattedConversation = formatConversation(conversation, req.userId, isFriend);

      if (global.io) {
        global.io.to(String(recipientId)).emit('new_pending_message', {
          conversationId: id,
          message: {
            _id: `pending_${Date.now()}`,
            senderId: req.userId,
            content: trimmedContent,
            createdAt: new Date(),
          },
          lastMessage: trimmedContent,
          lastMessageAt: conversation.lastMessageAt,
          conversation: formatConversation(conversation, recipientId, isFriend),
        });
      }

      res.status(201).json({
        success: true,
        data: null,
        conversation: formattedConversation,
      });
      return;
    }

    // Active flow (either Group or active 1-to-1)
    const message = await Message.create({
      conversationId: id,
      senderId: req.userId,
      content: trimmedContent,
      readBy: [req.userId],
    });

    conversation.lastMessage = trimmedContent;
    conversation.lastMessageAt = message.createdAt;
    setUnreadCount(conversation, req.userId, 0);
    
    otherParticipants.forEach((pId) => {
      const pIdStr = String(pId._id || pId);
      setUnreadCount(conversation, pIdStr, getUnreadCount(conversation, pIdStr) + 1);
    });
    
    conversation.deletedByUserIds = [];
    conversation.markModified('deletedByUserIds');
    await conversation.save();

    const populatedMessage = await Message.findById(message._id).populate('senderId', USER_SELECT);
    const formattedConversation = formatConversation(
      await Conversation.findById(id).populate('participants', USER_SELECT),
      req.userId,
      isFriend
    );

    if (global.io) {
      await Promise.all(
        otherParticipants.map(async (pId) => {
          const pIdStr = String(pId._id || pId);
          global.io.to(pIdStr).emit('new_message', {
            conversationId: id,
            message: populatedMessage,
            lastMessage: trimmedContent,
            lastMessageAt: conversation.lastMessageAt,
            conversation: formatConversation(
              await Conversation.findById(id).populate('participants', USER_SELECT),
              pIdStr,
              isFriend
            ),
          });
          await emitChatUnreadCount(pIdStr);
        })
      );
    }

    res.status(201).json({
      success: true,
      data: populatedMessage,
      conversation: formattedConversation,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gửi tin nhắn' });
  }
};

exports.acceptConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id).populate('participants', USER_SELECT);

    if (
      !conversation ||
      !conversation.participants.some(
        (participant) => String(participant._id) === String(req.userId)
      )
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    // Idempotent: if already accepted, return success without processing
    if (conversation.status === 'active') {
      const isFriend = await areMutualFriends(req.userId, conversation.participants[0]);
      const formattedForMe = formatConversation(conversation, req.userId, isFriend);
      return res.status(200).json({
        success: true,
        data: formattedForMe,
        alreadyAccepted: true,
      });
    }

    if (conversation.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Cuộc trò chuyện không ở trạng thái chờ' });
    }

    // Idempotent: only add if not already present
    const acceptedByIds = (conversation.acceptedBy || []).map((id) => String(id._id || id));
    if (!acceptedByIds.includes(String(req.userId))) {
      conversation.acceptedBy.push(req.userId);
    }

    // Move ALL pending messages to Message collection (acceptance applies to whole conversation)
    const allPendingMessages = conversation.pendingMessages || [];

    const messagesToCreate = allPendingMessages.map((msg) => ({
      conversationId: id,
      senderId: msg.senderId,
      content: msg.content,
      readBy: [req.userId],
      createdAt: msg.createdAt,
    }));

    if (messagesToCreate.length > 0) {
      await Message.insertMany(messagesToCreate);
    }

    // Clear ALL pending messages (not filtered by sender)
    conversation.pendingMessages = [];

    // Set status to active (all pending messages are now accepted)
    conversation.status = 'active';
    conversation.acceptedAt = new Date();
    await conversation.save();

    const isFriend = await areMutualFriends(req.userId, conversation.participants[0]);
    const formattedForMe = formatConversation(conversation, req.userId, isFriend);

    if (global.io) {
      const otherId = String(
        conversation.participants.find((p) => String(p._id) !== String(req.userId))._id
      );
      global.io.to(otherId).emit('conversation_accepted', {
        conversationId: id,
        conversation: formatConversation(conversation, otherId, isFriend),
        acceptedMessages: messagesToCreate,
      });
    }

    res.status(200).json({
      success: true,
      data: formattedForMe,
      acceptedMessages: messagesToCreate,
    });
  } catch (error) {
    console.error('Accept conversation error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xác nhận tin nhắn chờ' });
  }
};

exports.blockConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id).populate('participants', USER_SELECT);

    if (
      !conversation ||
      !conversation.participants.some(
        (participant) => String(participant._id) === String(req.userId)
      )
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    conversation.blockedByUserId = req.userId;
    // Giữ nguyên pendingMessages - không xóa để preserve message history
    await conversation.save();

    const otherId = String(
      conversation.participants.find((p) => String(p._id) !== String(req.userId))._id
    );

    if (global.io) {
      global.io.to(otherId).emit('conversation_blocked', {
        conversationId: id,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã chặn cuộc trò chuyện',
    });
  } catch (error) {
    console.error('Block conversation error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi chặn cuộc trò chuyện' });
  }
};

exports.unblockConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (
      !conversation ||
      !conversation.participants.some(
        (participantId) => String(participantId) === String(req.userId)
      )
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    if (!isBlockedByMe(conversation, req.userId)) {
      return res.status(400).json({ success: false, message: 'Cuộc trò chuyện này không bị chặn' });
    }

    conversation.blockedByUserId = null;
    // Chỉ set pending nếu là conversation mới (chưa active)
    // Nếu đã active trước đó thì giữ nguyên
    if (conversation.status !== 'active') {
      conversation.status = 'pending';
    }
    conversation.pendingMessages = conversation.pendingMessages || [];
    await conversation.save();

    const populated = await Conversation.findById(id).populate('participants', USER_SELECT);
    const isFriend = await activateConversationIfFriends(populated);
    const formatted = formatConversation(populated, req.userId, isFriend);

    const recipientId = conversation.participants.find(
      (participantId) => String(participantId) !== String(req.userId)
    );

    if (global.io) {
      global.io.to(String(recipientId)).emit('conversation_unblocked', {
        conversationId: id,
        conversation: formatted,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã bỏ chặn cuộc trò chuyện',
      data: formatted,
    });
  } catch (error) {
    console.error('Unblock conversation error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi bỏ chặn cuộc trò chuyện' });
  }
};

exports.deletePendingMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (
      !conversation ||
      !conversation.participants.some(
        (participantId) => String(participantId) === String(req.userId)
      )
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    if (conversation.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Chỉ xóa được tin nhắn chờ' });
    }

    const userIdStr = String(req.userId);
    conversation.pendingMessages = (conversation.pendingMessages || []).filter(
      (msg) => String(msg.senderId) !== userIdStr
    );

    const deletedIds = conversation.deletedByUserIds.map(id => String(id));
    if (!deletedIds.includes(userIdStr)) {
      conversation.deletedByUserIds.push(req.userId);
    }
    conversation.markModified('deletedByUserIds');

    if (!conversation.deletedAtByUser || typeof conversation.deletedAtByUser !== 'object') {
      conversation.deletedAtByUser = {};
    }
    conversation.deletedAtByUser[userIdStr] = new Date();
    conversation.markModified('deletedAtByUser');

    await conversation.save();

    const otherId = String(
      conversation.participants.find((p) => String(p._id) !== String(req.userId))._id
    );

    if (global.io) {
      global.io.to(otherId).emit('pending_messages_deleted', {
        conversationId: id,
        deletedByUserId: req.userId,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã xóa tin nhắn chờ',
    });
  } catch (error) {
    console.error('Delete pending messages error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa tin nhắn chờ' });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (
      !conversation ||
      !conversation.participants.some(
        (participantId) => String(participantId) === String(req.userId)
      )
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    const userIdStr = String(req.userId);
    const deletedIds = conversation.deletedByUserIds.map(id => String(id));
    if (!deletedIds.includes(userIdStr)) {
      conversation.deletedByUserIds.push(req.userId);
    }
    conversation.markModified('deletedByUserIds');

    if (!conversation.deletedAtByUser || typeof conversation.deletedAtByUser !== 'object') {
      conversation.deletedAtByUser = {};
    }
    conversation.deletedAtByUser[userIdStr] = new Date();
    conversation.markModified('deletedAtByUser');

    await conversation.save();

    res.status(200).json({
      success: true,
      conversationId: id,
      message: 'Đã xóa cuộc trò chuyện',
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa cuộc trò chuyện' });
  }
};

exports.muteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (
      !conversation ||
      !conversation.participants.some(
        (participantId) => String(participantId) === String(req.userId)
      )
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    const userIdStr = String(req.userId);
    if (!conversation.mutedByUserIds.map(id => String(id)).includes(userIdStr)) {
      conversation.mutedByUserIds.push(req.userId);
    }
    conversation.markModified('mutedByUserIds');
    await conversation.save();

    res.status(200).json({
      success: true,
      conversationId: id,
      isMuted: true,
      message: 'Đã tắt thông báo',
    });
  } catch (error) {
    console.error('Mute conversation error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tắt thông báo' });
  }
};

exports.unmuteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (
      !conversation ||
      !conversation.participants.some(
        (participantId) => String(participantId) === String(req.userId)
      )
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    conversation.mutedByUserIds = (conversation.mutedByUserIds || []).filter(
      (id) => String(id) !== String(req.userId)
    );
    conversation.markModified('mutedByUserIds');
    await conversation.save();

    res.status(200).json({
      success: true,
      conversationId: id,
      isMuted: false,
      message: 'Đã bật thông báo',
    });
  } catch (error) {
    console.error('Unmute conversation error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi bật thông báo' });
  }
};

exports.markConversationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (
      !conversation ||
      !conversation.participants.some(
        (participantId) => String(participantId) === String(req.userId)
      )
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    await Message.updateMany(
      {
        conversationId: id,
        senderId: { $ne: req.userId },
        readBy: { $ne: req.userId },
      },
      { $addToSet: { readBy: req.userId } }
    );

    setUnreadCount(conversation, req.userId, 0);
    await conversation.save();
    await emitChatUnreadCount(req.userId);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Mark conversation read error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi đánh dấu đã đọc' });
  }
};

exports.updateGroupInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const conversation = await Conversation.findById(id).populate('participants', USER_SELECT);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    if (!conversation.isGroup) {
      return res.status(400).json({ success: false, message: 'Hội thoại này không phải là nhóm' });
    }

    // Verify admin or co-admin
    if (!isAdminOrCoAdmin(conversation, req.userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ quản trị viên mới có quyền chỉnh sửa nhóm' });
    }

    if (name !== undefined && name !== '') {
      conversation.name = name.trim();
    }

    if (req.file) {
      conversation.avatar = `${API_BASE_URL}/uploads/conversations/${req.file.filename}`;
    }

    await conversation.save();

    // Format for current user
    const formatted = formatConversation(conversation, req.userId, true);

    // Notify other participants via socket
    if (global.io) {
      conversation.participants.forEach((p) => {
        const pIdStr = String(p._id || p);
        if (pIdStr !== String(req.userId)) {
          global.io.to(pIdStr).emit('group_updated', {
            conversationId: id,
            conversation: formatConversation(conversation, pIdStr, true),
          });
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin nhóm thành công',
      data: formatted,
    });
  } catch (error) {
    console.error('Update group info error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thông tin nhóm' });
  }
};

exports.addParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách thành viên cần thêm không hợp lệ' });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    if (!conversation.isGroup) {
      return res.status(400).json({ success: false, message: 'Hội thoại này không phải là nhóm' });
    }

    // Verify admin or co-admin (required for direct add)
    if (!isAdminOrCoAdmin(conversation, req.userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ quản trị viên mới có quyền thêm thành viên trực tiếp. Thành viên thường có thể yêu cầu thêm qua link mời.' });
    }

    // Add new userIds without duplicates
    let addedCount = 0;
    userIds.forEach((userId) => {
      const exists = conversation.participants.some((p) => String(p) === String(userId));
      if (!exists) {
        conversation.participants.push(userId);
        if (!conversation.acceptedBy.includes(userId)) {
          conversation.acceptedBy.push(userId);
        }
        // Track who added this user
        if (!conversation.addedBy) conversation.addedBy = {};
        conversation.addedBy[String(userId)] = String(req.userId);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      conversation.markModified('addedBy');
      await conversation.save();
    }

    const updated = await Conversation.findById(id).populate('participants', USER_SELECT);
    
    // Notify all participants via socket
    if (global.io) {
      updated.participants.forEach((p) => {
        const pIdStr = String(p._id || p);
        global.io.to(pIdStr).emit('group_updated', {
          conversationId: id,
          conversation: formatConversation(updated, pIdStr, true),
        });
      });
    }

    res.status(200).json({
      success: true,
      message: `Đã thêm ${addedCount} thành viên thành công`,
      data: formatConversation(updated, req.userId, true),
    });
  } catch (error) {
    console.error('Add participants error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi thêm thành viên vào nhóm' });
  }
};

exports.leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    if (!conversation.isGroup) {
      return res.status(400).json({ success: false, message: 'Hội thoại này không phải là nhóm' });
    }

    // Verify requesting user is a participant
    const isParticipant = conversation.participants.some(
      (p) => String(p) === String(req.userId)
    );
    if (!isParticipant) {
      return res.status(400).json({ success: false, message: 'Bạn không phải là thành viên nhóm này' });
    }

    // Remove participant
    conversation.participants = conversation.participants.filter(
      (p) => String(p) !== String(req.userId)
    );

    // Remove from acceptedBy too
    conversation.acceptedBy = (conversation.acceptedBy || []).filter(
      (p) => String(p) !== String(req.userId)
    );

    // Transfer admin if the leaving user is the admin
    if (conversation.admin && String(conversation.admin) === String(req.userId) && conversation.participants.length > 0) {
      // Priority: first coAdmin, then first remaining participant
      const nextAdmin = (conversation.coAdmins || []).find(id => 
        conversation.participants.some(p => String(p) === String(id))
      );
      if (nextAdmin) {
        conversation.admin = nextAdmin;
        conversation.coAdmins = conversation.coAdmins.filter(id => String(id) !== String(nextAdmin));
      } else {
        conversation.admin = conversation.participants[0];
      }
    }
    // Also remove from coAdmins and mutedMembers
    conversation.coAdmins = (conversation.coAdmins || []).filter(id => String(id) !== String(req.userId));
    conversation.mutedMembers = (conversation.mutedMembers || []).filter(id => String(id) !== String(req.userId));

    if (conversation.participants.length === 0) {
      // If no participants left, disband group (delete conversation from DB)
      await Conversation.findByIdAndDelete(id);
    } else {
      await conversation.save();

      const updated = await Conversation.findById(id).populate('participants', USER_SELECT);

      // Notify remaining participants via socket
      if (global.io) {
        updated.participants.forEach((p) => {
          const pIdStr = String(p._id || p);
          global.io.to(pIdStr).emit('group_updated', {
            conversationId: id,
            conversation: formatConversation(updated, pIdStr, true),
          });
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Đã rời khỏi nhóm thành công',
    });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi rời khỏi nhóm' });
  }
};

exports.removeParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID thành viên cần xóa không hợp lệ' });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    if (!conversation.isGroup) {
      return res.status(400).json({ success: false, message: 'Hội thoại này không phải là nhóm' });
    }

    // Verify requesting user is Admin or Co-Admin
    if (!isAdminOrCoAdmin(conversation, req.userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa thành viên khỏi nhóm này' });
    }

    // Cannot remove creator admin
    const creatorId = conversation.admin ? String(conversation.admin._id || conversation.admin) : String(conversation.participants[0]?._id || conversation.participants[0]);
    if (String(userId) === creatorId) {
      return res.status(403).json({ success: false, message: 'Không thể xóa Creator Admin khỏi nhóm' });
    }

    // Cannot remove oneself
    if (String(userId) === String(req.userId)) {
      return res.status(400).json({ success: false, message: 'Bạn không thể tự xóa chính mình khỏi nhóm theo cách này' });
    }

    // Remove participant
    conversation.participants = conversation.participants.filter(
      (p) => String(p) !== String(userId)
    );

    // Remove from acceptedBy
    conversation.acceptedBy = (conversation.acceptedBy || []).filter(
      (p) => String(p) !== String(userId)
    );

    // Also remove from coAdmins and mutedMembers
    conversation.coAdmins = (conversation.coAdmins || []).filter(p => String(p) !== String(userId));
    conversation.mutedMembers = (conversation.mutedMembers || []).filter(p => String(p) !== String(userId));

    await conversation.save();

    const updated = await Conversation.findById(id).populate('participants', USER_SELECT);

    // Notify all participants via socket (including the removed user, so they know they are kicked)
    if (global.io) {
      // Notify the removed user
      global.io.to(String(userId)).emit('group_updated', {
        conversationId: id,
        conversation: null,
      });

      // Notify remaining participants
      updated.participants.forEach((p) => {
        const pIdStr = String(p._id || p);
        global.io.to(pIdStr).emit('group_updated', {
          conversationId: id,
          conversation: formatConversation(updated, pIdStr, true),
        });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã xóa thành viên khỏi nhóm thành công',
      data: formatConversation(updated, req.userId, true),
    });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa thành viên khỏi nhóm' });
  }
};

// === GROUP PERMISSIONS ===

exports.updateMemberRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    if (!userId || !['coAdmin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Thông tin không hợp lệ' });
    }

    const conversation = await Conversation.findById(id).populate('participants', USER_SELECT);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
    }

    // Only Admins can change roles
    if (!isAdmin(conversation, req.userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền thay đổi vai trò' });
    }

    // Cannot change main creator's role
    const creatorId = conversation.admin ? String(conversation.admin._id || conversation.admin) : String(conversation.participants[0]?._id || conversation.participants[0]);
    if (String(userId) === creatorId) {
      return res.status(400).json({ success: false, message: 'Không thể thay đổi vai trò của Creator Admin' });
    }

    // Cannot change own role
    if (String(userId) === String(req.userId)) {
      return res.status(400).json({ success: false, message: 'Không thể tự thay đổi vai trò của chính mình' });
    }

    // Target must be a participant
    const isMember = conversation.participants.some(p => String(p._id || p) === String(userId));
    if (!isMember) {
      return res.status(400).json({ success: false, message: 'Người dùng không phải thành viên nhóm' });
    }

    const coAdminIds = (conversation.coAdmins || []).map(id => String(id._id || id));

    if (role === 'coAdmin') {
      if (!coAdminIds.includes(String(userId))) {
        conversation.coAdmins.push(userId);
      }
    } else {
      conversation.coAdmins = (conversation.coAdmins || []).filter(id => String(id._id || id) !== String(userId));
    }

    await conversation.save();

    const updated = await Conversation.findById(id).populate('participants', USER_SELECT);

    if (global.io) {
      updated.participants.forEach(p => {
        const pIdStr = String(p._id || p);
        global.io.to(pIdStr).emit('group_updated', {
          conversationId: id,
          conversation: formatConversation(updated, pIdStr, true),
        });
      });
    }

    res.status(200).json({
      success: true,
      message: role === 'coAdmin' ? 'Đã đặt làm Admin' : 'Đã gỡ vai trò Admin',
      data: formatConversation(updated, req.userId, true),
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật vai trò thành viên' });
  }
};

exports.muteMemberInGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID thành viên không hợp lệ' });
    }

    const conversation = await Conversation.findById(id).populate('participants', USER_SELECT);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
    }

    if (!isAdmin(conversation, req.userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ quản trị viên mới có quyền chặn thành viên' });
    }

    // Cannot mute admin
    if (isAdmin(conversation, userId)) {
      return res.status(400).json({ success: false, message: 'Không thể chặn quản trị viên' });
    }

    const mutedIds = (conversation.mutedMembers || []).map(id => String(id._id || id));
    if (!mutedIds.includes(String(userId))) {
      conversation.mutedMembers.push(userId);
    }

    await conversation.save();

    // Link to personal block: Find or create direct 1-to-1 conversation
    const allParticipants = [req.userId, userId].map(id => String(id)).sort();
    const participantKey = allParticipants.join('_');
    let directConv = await Conversation.findOne({
      isGroup: false,
      participantKey
    });

    if (directConv) {
      directConv.blockedByUserId = req.userId;
      await directConv.save();
    } else {
      directConv = await Conversation.create({
        participants: [req.userId, userId],
        participantKey,
        isGroup: false,
        acceptedBy: [req.userId],
        blockedByUserId: req.userId
      });
    }

    const updated = await Conversation.findById(id).populate('participants', USER_SELECT);

    if (global.io) {
      // Notify all participants
      updated.participants.forEach(p => {
        const pIdStr = String(p._id || p);
        global.io.to(pIdStr).emit('group_updated', {
          conversationId: id,
          conversation: formatConversation(updated, pIdStr, true),
        });
      });
      // Special event for the muted user
      global.io.to(String(userId)).emit('member_muted', {
        conversationId: id,
      });

      // Socket event for direct conversation block
      global.io.to(String(userId)).emit('conversation_blocked', {
        conversationId: String(directConv._id),
        blockedByUserId: req.userId,
      });
      global.io.to(String(req.userId)).emit('conversation_blocked', {
        conversationId: String(directConv._id),
        blockedByUserId: req.userId,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã chặn thành viên',
      data: formatConversation(updated, req.userId, true),
    });
  } catch (error) {
    console.error('Mute member error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi chặn thành viên' });
  }
};

exports.unmuteMemberInGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID thành viên không hợp lệ' });
    }

    const conversation = await Conversation.findById(id).populate('participants', USER_SELECT);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
    }

    if (!isAdmin(conversation, req.userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ quản trị viên mới có quyền bỏ chặn thành viên' });
    }

    conversation.mutedMembers = (conversation.mutedMembers || []).filter(
      id => String(id._id || id) !== String(userId)
    );

    await conversation.save();

    // Link to personal unblock: Find direct 1-to-1 conversation
    const allParticipants = [req.userId, userId].map(id => String(id)).sort();
    const participantKey = allParticipants.join('_');
    const directConv = await Conversation.findOne({
      isGroup: false,
      participantKey
    });

    if (directConv && String(directConv.blockedByUserId) === String(req.userId)) {
      directConv.blockedByUserId = null;
      await directConv.save();
    }

    const updated = await Conversation.findById(id).populate('participants', USER_SELECT);

    if (global.io) {
      updated.participants.forEach(p => {
        const pIdStr = String(p._id || p);
        global.io.to(pIdStr).emit('group_updated', {
          conversationId: id,
          conversation: formatConversation(updated, pIdStr, true),
        });
      });
      global.io.to(String(userId)).emit('member_unmuted', {
        conversationId: id,
      });

      if (directConv) {
        global.io.to(String(userId)).emit('conversation_unblocked', {
          conversationId: String(directConv._id),
        });
        global.io.to(String(req.userId)).emit('conversation_unblocked', {
          conversationId: String(directConv._id),
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Đã bỏ chặn thành viên',
      data: formatConversation(updated, req.userId, true),
    });
  } catch (error) {
    console.error('Unmute member error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi bỏ chặn thành viên' });
  }
};

// === NICKNAMES ===

exports.updateNickname = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, nickname } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID thành viên không hợp lệ' });
    }

    const conversation = await Conversation.findById(id).populate('participants', USER_SELECT);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    // Verify participant
    const isParticipant = conversation.participants.some(
      p => String(p._id || p) === String(req.userId)
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Bạn không phải thành viên cuộc trò chuyện này' });
    }

    // Target must be a participant
    const targetIsParticipant = conversation.participants.some(
      p => String(p._id || p) === String(userId)
    );
    if (!targetIsParticipant) {
      return res.status(400).json({ success: false, message: 'Người dùng không phải thành viên cuộc trò chuyện' });
    }

    if (!conversation.nicknames || typeof conversation.nicknames !== 'object') {
      conversation.nicknames = {};
    }

    const trimmed = (nickname || '').trim();
    if (trimmed) {
      conversation.nicknames[String(userId)] = trimmed;
    } else {
      delete conversation.nicknames[String(userId)];
    }
    conversation.markModified('nicknames');

    await conversation.save();

    const updated = await Conversation.findById(id).populate('participants', USER_SELECT);

    if (global.io) {
      updated.participants.forEach(p => {
        const pIdStr = String(p._id || p);
        global.io.to(pIdStr).emit('group_updated', {
          conversationId: id,
          conversation: formatConversation(updated, pIdStr, true),
        });
      });
    }

    res.status(200).json({
      success: true,
      message: trimmed ? 'Đã cập nhật biệt danh' : 'Đã xóa biệt danh',
      data: formatConversation(updated, req.userId, true),
    });
  } catch (error) {
    console.error('Update nickname error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật biệt danh' });
  }
};

// === INVITE LINK ===

exports.generateInviteLink = async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findById(id).populate('participants', USER_SELECT);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
    }

    if (!isAdminOrCoAdmin(conversation, req.userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ quản trị viên mới có quyền tạo link mời' });
    }

    // Generate a new invite code if none exists
    if (!conversation.inviteCode) {
      const crypto = require('crypto');
      conversation.inviteCode = crypto.randomBytes(6).toString('hex');
    }
    conversation.inviteLinkEnabled = true;

    await conversation.save();

    res.status(200).json({
      success: true,
      message: 'Đã tạo link mời nhóm',
      data: {
        inviteCode: conversation.inviteCode,
        inviteLinkEnabled: conversation.inviteLinkEnabled,
      },
    });
  } catch (error) {
    console.error('Generate invite link error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo link mời' });
  }
};

exports.revokeInviteLink = async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findById(id).populate('participants', USER_SELECT);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
    }

    if (!isAdminOrCoAdmin(conversation, req.userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ quản trị viên mới có quyền vô hiệu hóa link mời' });
    }

    conversation.inviteLinkEnabled = false;
    // Generate a new code so old links are permanently invalidated
    const crypto = require('crypto');
    conversation.inviteCode = crypto.randomBytes(6).toString('hex');

    await conversation.save();

    res.status(200).json({
      success: true,
      message: 'Đã vô hiệu hóa link mời',
    });
  } catch (error) {
    console.error('Revoke invite link error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi vô hiệu hóa link mời' });
  }
};

exports.getInviteLinkInfo = async (req, res) => {
  try {
    const { code } = req.params;

    const conversation = await Conversation.findOne({ inviteCode: code, inviteLinkEnabled: true })
      .populate('participants', USER_SELECT);

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Link mời không hợp lệ hoặc đã hết hạn' });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: conversation._id,
        name: conversation.name || '',
        avatar: conversation.avatar || '',
        memberCount: conversation.participants.length,
      },
    });
  } catch (error) {
    console.error('Get invite link info error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thông tin link mời' });
  }
};

exports.joinViaInviteLink = async (req, res) => {
  try {
    const { code } = req.params;

    const conversation = await Conversation.findOne({ inviteCode: code, inviteLinkEnabled: true });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Link mời không hợp lệ hoặc đã hết hạn' });
    }

    const isMember = conversation.participants.some(
      p => String(p) === String(req.userId)
    );
    if (isMember) {
      const populated = await Conversation.findById(conversation._id).populate('participants', USER_SELECT);
      return res.status(200).json({
        success: true,
        message: 'Bạn đã là thành viên nhóm này',
        alreadyMember: true,
        data: formatConversation(populated, req.userId, true),
      });
    }

    if (conversation.requireApproval) {
      const existingRequest = conversation.joinRequests.some(
        r => String(r.userId) === String(req.userId)
      );
      if (existingRequest) {
        return res.status(200).json({
          success: true,
          requiresApproval: true,
          alreadyRequested: true,
          message: 'Bạn đã gửi yêu cầu tham gia, vui lòng chờ duyệt',
        });
      }

      conversation.joinRequests.push({ userId: req.userId, requestedBy: req.userId });
      await conversation.save();

      const updated = await Conversation.findById(conversation._id).populate('participants', USER_SELECT);

      const rawNotifyUserIds = [
        String(conversation.admin || conversation.participants?.[0]),
        ...(conversation.coAdmins || []).map(id => String(id)),
      ];
      const notifyUserIds = [...new Set(rawNotifyUserIds.filter(Boolean))];

      await Promise.all(
        notifyUserIds.map(adminId =>
          Notification.create({
            userId: adminId,
            type: 'group',
            fromUserId: req.userId,
            message: `${req.user?.name || 'Ai đó'} đã gửi yêu cầu tham gia nhóm "${conversation.name || ''}"`,
            conversationId: conversation._id,
          })
        )
      );

      if (global.io) {
        notifyUserIds.forEach(adminId => {
          global.io.to(adminId).emit('group_join_requested', {
            conversationId: conversation._id,
            conversation: formatConversation(updated, adminId, true),
          });
        });
      }

      return res.status(200).json({
        success: true,
        requiresApproval: true,
        alreadyRequested: false,
        message: 'Đã gửi yêu cầu tham gia, vui lòng chờ Quản trị viên duyệt',
      });
    }

    conversation.participants.push(req.userId);
    if (!conversation.acceptedBy.some(id => String(id) === String(req.userId))) {
      conversation.acceptedBy.push(req.userId);
    }

    if (!conversation.unreadByUser || typeof conversation.unreadByUser !== 'object') {
      conversation.unreadByUser = {};
    }
    conversation.unreadByUser[String(req.userId)] = 0;
    conversation.markModified('unreadByUser');

    await conversation.save();

    const updated = await Conversation.findById(conversation._id).populate('participants', USER_SELECT);

    if (global.io) {
      updated.participants.forEach(p => {
        const pIdStr = String(p._id || p);
        global.io.to(pIdStr).emit('group_updated', {
          conversationId: String(conversation._id),
          conversation: formatConversation(updated, pIdStr, true),
        });
      });
    }

    return res.status(200).json({
      success: true,
      requiresApproval: false,
      message: 'Đã tham gia nhóm thành công',
      data: formatConversation(updated, req.userId, true),
    });
  } catch (error) {
    console.error('Join via invite link error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tham gia nhóm' });
  }
};

// ─── GỬi ảnh trong hội thoại nhóm ─────────────────────────────────────────
exports.sendImageMessage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không có ảnh được gửi' });
    }

    const conversation = await Conversation.findById(id);
    if (
      !conversation ||
      !conversation.participants.some((p) => String(p._id || p) === String(req.userId))
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    // Kiểm tra mute
    if (
      conversation.isGroup &&
      (conversation.mutedMembers || []).some((id) => String(id) === String(req.userId))
    ) {
      return res.status(403).json({ success: false, message: 'Bạn đã bị cấm chat trong nhóm này' });
    }

    const mediaUrl = `${API_BASE_URL}/uploads/conversations/${req.file.filename}`;

    const message = await Message.create({
      conversationId: id,
      senderId: req.userId,
      type: 'image',
      content: '',
      mediaUrl,
      readBy: [req.userId],
    });

    const otherParticipants = conversation.participants.filter(
      (p) => String(p._id || p) !== String(req.userId)
    );

    conversation.lastMessage = '📷 Ảnh';
    conversation.lastMessageAt = message.createdAt;
    setUnreadCount(conversation, req.userId, 0);
    otherParticipants.forEach((pId) => {
      const pIdStr = String(pId._id || pId);
      setUnreadCount(conversation, pIdStr, getUnreadCount(conversation, pIdStr) + 1);
    });
    await conversation.save();

    const populatedMessage = await Message.findById(message._id).populate('senderId', USER_SELECT);
    const populatedConversation = await Conversation.findById(id).populate('participants', USER_SELECT);
    const formattedConversation = formatConversation(populatedConversation, req.userId, true);

    if (global.io) {
      await Promise.all(
        otherParticipants.map(async (pId) => {
          const pIdStr = String(pId._id || pId);
          global.io.to(pIdStr).emit('new_message', {
            conversationId: id,
            message: populatedMessage,
            lastMessage: '📷 Ảnh',
            lastMessageAt: conversation.lastMessageAt,
            conversation: formatConversation(populatedConversation, pIdStr, true),
          });
          await emitChatUnreadCount(pIdStr);
        })
      );
    }

    res.status(201).json({ success: true, data: populatedMessage, conversation: formattedConversation });
  } catch (error) {
    console.error('Send image message error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gửi ảnh' });
  }
};

// ─── Duyệt yêu cầu gia nhóm (Admin/Mod) ─────────────────────────────────────
exports.approveJoinRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: targetUserId, requesterId } = req.body;

    const conversation = await Conversation.findById(id).populate('joinRequests.userId', USER_SELECT);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
    }

    if (!isAdminOrCoAdmin(conversation, req.userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền duyệt thành viên' });
    }

    const targetIdStr = String(targetUserId);
    const requesterIdStr = requesterId ? String(requesterId) : null;

    const request = conversation.joinRequests.find((r) => {
      const userIdMatch = String(r.userId?._id || r.userId) === targetIdStr;
      const requesterMatch = requesterIdStr
        ? String(r.requestedBy || '') === requesterIdStr
        : true;
      return userIdMatch && requesterMatch;
    });

    if (!request) {
      const fallback = conversation.joinRequests.find(
        (r) => String(r.userId?._id || r.userId) === targetIdStr
      );
      if (!fallback) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu' });
      }
      return res.status(200).json({
        success: false,
        message: 'Yêu cầu hiện tại không khớp người duyệt, vui lòng thử lại.',
      });
    }

    const requestedBy = request.requestedBy;

    conversation.joinRequests = conversation.joinRequests.filter(
      (r) => String(r.userId?._id || r.userId) !== targetIdStr
    );

    const isAlreadyIn = conversation.participants.some(
      (p) => String(p._id || p) === targetIdStr
    );
    if (!isAlreadyIn) {
      conversation.participants.push(targetUserId);
      conversation.acceptedBy.push(targetUserId);
      if (!conversation.unreadByUser) conversation.unreadByUser = {};
      conversation.unreadByUser[targetIdStr] = 0;
      conversation.markModified('unreadByUser');
      if (!conversation.addedBy) conversation.addedBy = {};
      conversation.addedBy[targetIdStr] = String(requestedBy || req.userId);
      conversation.markModified('addedBy');
    }

    await conversation.save();
    const updated = await Conversation.findById(id).populate('participants', USER_SELECT).populate('joinRequests.userId', USER_SELECT);
    const formatted = formatConversation(updated, req.userId, true);

    if (global.io) {
      global.io.to(targetIdStr).emit('join_request_approved', {
        conversationId: id,
        conversation: formatConversation(updated, targetIdStr, true),
      });
    }

    res.status(200).json({ success: true, message: 'Phê duyệt thành công', data: formatted });
  } catch (error) {
    console.error('Approve join request error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi phê duyệt' });
  }
};

// ─── Từ chối yêu cầu gia nhóm (Admin/Mod) ──────────────────────────────────
exports.rejectJoinRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: targetUserId, requesterId } = req.body;

    const conversation = await Conversation.findById(id).populate('joinRequests.userId', USER_SELECT);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
    }

    if (!isAdminOrCoAdmin(conversation, req.userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền từ chối' });
    }

    const targetIdStr = String(targetUserId);
    const requesterIdStr = requesterId ? String(requesterId) : null;

    const request = conversation.joinRequests.find((r) => {
      const userIdMatch = String(r.userId?._id || r.userId) === targetIdStr;
      const requesterMatch = requesterIdStr
        ? String(r.requestedBy || '') === requesterIdStr
        : true;
      return userIdMatch && requesterMatch;
    });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu' });
    }

    conversation.joinRequests = conversation.joinRequests.filter(
      (r) => String(r.userId?._id || r.userId) !== targetIdStr
    );
    await conversation.save();

    const updated = await Conversation.findById(id).populate('participants', USER_SELECT).populate('joinRequests.userId', USER_SELECT);
    const formatted = formatConversation(updated, req.userId, true);

    // Thông báo cho thành viên bị từ chối
    if (global.io) {
      global.io.to(targetIdStr).emit('join_request_rejected', {
        conversationId: id,
        conversation: formatConversation(updated, targetIdStr, true),
      });
    }

    res.status(200).json({ success: true, message: 'Từ chối thành công', data: formatted });
  } catch (error) {
    console.error('Reject join request error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi từ chối' });
  }
};

// ─── Gửi yêu cầu thêm thành viên (Thành viên thường yêu cầu admin thêm) ───────
exports.requestAddMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin người cần thêm' });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
    }

    // Người gửi yêu cầu phải là thành viên của nhóm
    const isParticipant = conversation.participants.some(
      (p) => String(p) === String(req.userId)
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên của nhóm này' });
    }

    // Người được thêm không được là thành viên hiện tại
    if (conversation.participants.some((p) => String(p) === String(targetUserId))) {
      return res.status(400).json({ success: false, message: 'Người này đã là thành viên của nhóm' });
    }

    // Kiểm tra đã gửi yêu cầu thêm người này chưa
    const alreadyRequested = conversation.joinRequests.some(
      (r) => String(r.userId) === String(targetUserId) && String(r.requestedBy) === String(req.userId)
    );
    if (alreadyRequested) {
      return res.status(400).json({ success: false, message: 'Bạn đã gửi yêu cầu thêm người này rồi, vui lòng chờ duyệt' });
    }

    conversation.joinRequests.push({
      userId: targetUserId,
      requestedBy: req.userId,
      requestedAt: new Date(),
    });
    await conversation.save();

    const requester = await User.findById(req.userId).select('name').lean();
    const requesterName = requester?.name || 'Thành viên';

    const targetUser = await User.findById(targetUserId).select('name').lean();
    const targetUserName = targetUser?.name || 'Thành viên';

    const updated = await Conversation.findById(id).populate('participants', USER_SELECT).populate('joinRequests.userId', USER_SELECT);
    const formatted = formatConversation(updated, req.userId, true);

    // Notify admin and coAdmins via socket
    const rawNotifyUserIds = [
      String(conversation.admin || conversation.participants?.[0]),
      ...(conversation.coAdmins || []).map((uid) => String(uid)),
    ];
    const notifyUserIds = [...new Set(rawNotifyUserIds.filter(Boolean))];

    if (global.io) {
      notifyUserIds.forEach((adminId) => {
        global.io.to(adminId).emit('group_join_requested', {
          conversationId: id,
          conversation: formatConversation(updated, adminId, true),
        });
      });
    }

    const createdNotifications = await Promise.all(
      notifyUserIds.map((adminId) =>
        Notification.create({
          userId: adminId,
          type: 'group',
          fromUserId: req.userId,
          message: `${requesterName} đã đề xuất thêm ${targetUserName} vào nhóm "${conversation.name || ''}"`,
          conversationId: id,
        })
      )
    );

    const populatedNotifications = await Promise.all(
      createdNotifications.map((notif) =>
        Notification.findById(notif._id)
          .populate('fromUserId', 'name picture')
          .populate('conversationId', 'name lastMessage lastMessageAt')
      )
    );

    if (global.io) {
      notifyUserIds.forEach((adminId, idx) => {
        const notif = populatedNotifications[idx];
        if (notif) {
          global.io.to(String(adminId)).emit('new_notification', notif);
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã gửi yêu cầu thêm thành viên, vui lòng chờ Quản trị viên duyệt',
      data: formatted,
    });
  } catch (error) {
    console.error('Request add member error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gửi yêu cầu thêm thành viên' });
  }
};

// ─── Gửi yêu cầu gia nhập nhóm (Thành viên yêu cầu) ─────────────────────────
exports.requestToJoinGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm' });
    }

    // Check if already a participant
    if (conversation.participants.some((p) => String(p) === String(req.userId))) {
      return res.status(400).json({ success: false, message: 'Bạn đã là thành viên của nhóm này rồi' });
    }

    // Check if already requested
    const alreadyRequested = conversation.joinRequests.some(
      (r) => String(r.userId) === String(req.userId)
    );
    if (alreadyRequested) {
      return res.status(400).json({ success: false, message: 'Bạn đã gửi yêu cầu gia nhập nhóm rồi, vui lòng chờ duyệt' });
    }

    conversation.joinRequests.push({ userId: req.userId, requestedBy: req.userId });
    await conversation.save();

    const requester = await User.findById(req.userId).select('name').lean();
    const requesterName = requester?.name || 'Thành viên';

    // Notify group admin and coAdmins via socket if online
    const rawNotifyUserIds = [
      String(conversation.admin || conversation.participants?.[0]),
      ...(conversation.coAdmins || []).map((id) => String(id)),
    ];
    const notifyUserIds = [...new Set(rawNotifyUserIds.filter(Boolean))];

    const updated = await Conversation.findById(id).populate('participants', USER_SELECT).populate('joinRequests.userId', USER_SELECT);

    await Promise.all(
      notifyUserIds.map((adminId) =>
        Notification.create({
          userId: adminId,
          type: 'group',
          fromUserId: req.userId,
          message: `${requesterName} đã gửi yêu cầu tham gia nhóm "${conversation.name || ''}"`,
          conversationId: id,
        })
      )
    );

    const populatedNotifications = await Promise.all(
      notifyUserIds.map((adminId) =>
        Notification.findOne({ userId: adminId, type: 'group', conversationId: id, fromUserId: req.userId })
          .sort({ createdAt: -1 })
          .populate('fromUserId', 'name picture')
      )
    );

    if (global.io) {
      notifyUserIds.forEach((adminId, idx) => {
        const notif = populatedNotifications[idx];
        if (notif) {
          global.io.to(String(adminId)).emit('new_notification', notif);
        }
      });
    }

    if (global.io) {
      notifyUserIds.forEach((adminId) => {
        global.io.to(adminId).emit('group_join_requested', {
          conversationId: id,
          conversation: formatConversation(updated, adminId, true),
        });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Gửi yêu cầu tham gia thành công, vui lòng chờ Quản trị viên duyệt',
    });
  } catch (error) {
    console.error('Request to join group error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gửi yêu cầu tham gia' });
  }
};

// ─── Ghim / Bỏ ghim tin nhắn ───────────────────────────────────────────────
// === Ghim / Bỏ ghim tin nhắn (tối đa 3) ===
const MAX_PINNED_MESSAGES = 3;

exports.pinMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { messageId } = req.body;

    const conversation = await Conversation.findById(id);
    if (
      !conversation ||
      !conversation.participants.some((p) => String(p) === String(req.userId))
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    const message = await Message.findById(messageId);
    if (!message || String(message.conversationId) !== String(id)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
    }

    const pinnedMessages = conversation.pinnedMessages || [];

    const alreadyPinned = pinnedMessages.some(
      (p) => String(p.messageId) === String(messageId)
    );
    if (alreadyPinned) {
      return res.status(400).json({ success: false, message: 'Tin nhắn này đã được ghim' });
    }

    if (pinnedMessages.length >= MAX_PINNED_MESSAGES) {
      return res.status(400).json({
        success: false,
        message: `Chỉ được ghim tối đa ${MAX_PINNED_MESSAGES} tin nhắn`,
      });
    }

    pinnedMessages.push({
      messageId: message._id,
      pinnedAt: new Date(),
      pinnedBy: req.userId,
    });

    conversation.pinnedMessages = pinnedMessages;
    await conversation.save();

    const populated = await Conversation.findById(id)
      .populate('participants', USER_SELECT)
      .populate('pinnedMessages.messageId', USER_SELECT);

    const formatted = formatConversation(populated, req.userId, true);

    if (global.io) {
      conversation.participants.forEach((p) => {
        const pIdStr = String(p);
        global.io.to(pIdStr).emit('pinned_message', {
          conversationId: id,
          conversation: formatConversation(populated, pIdStr, true),
        });
      });
    }

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Pin message error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi ghim tin nhắn' });
  }
};

exports.unpinMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { messageId } = req.body;

    const conversation = await Conversation.findById(id);
    if (
      !conversation ||
      !conversation.participants.some((p) => String(p) === String(req.userId))
    ) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    const pinnedMessages = (conversation.pinnedMessages || [])
      .filter((p) => String(p.messageId) !== String(messageId));

    conversation.pinnedMessages = pinnedMessages;
    await conversation.save();

    const populated = await Conversation.findById(id)
      .populate('participants', USER_SELECT)
      .populate('pinnedMessages.messageId', USER_SELECT);

    const formatted = formatConversation(populated, req.userId, true);

    if (global.io) {
      conversation.participants.forEach((p) => {
        const pIdStr = String(p);
        global.io.to(pIdStr).emit('unpinned_message', {
          conversationId: id,
          conversation: formatConversation(populated, pIdStr, true),
        });
      });
    }

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Unpin message error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi bỏ ghim tin nhắn' });
  }
};

exports.recallMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
    }

    // Only the sender can recall the message
    if (String(message.senderId) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thu hồi tin nhắn này' });
    }

    if (message.isRecalled) {
      return res.status(400).json({ success: false, message: 'Tin nhắn đã được thu hồi trước đó' });
    }

    // Set isRecalled to true and clear content / mediaUrl for privacy
    message.isRecalled = true;
    message.content = 'Tin nhắn đã bị thu hồi';
    message.type = 'text'; // force text type so the client renders it as text
    message.mediaUrl = null;
    await message.save();

    // Update conversation if needed
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation) {
      // If pinned, remove it
      conversation.pinnedMessages = (conversation.pinnedMessages || []).filter(
        (p) => String(p.messageId) !== String(messageId)
      );

      // If last message, update lastMessage
      const msgCreatedAt = message.createdAt ? new Date(message.createdAt).getTime() : 0;
      const convLastMsgAt = conversation.lastMessageAt ? new Date(conversation.lastMessageAt).getTime() : 0;
      if (Math.abs(convLastMsgAt - msgCreatedAt) < 1000) {
        conversation.lastMessage = 'Tin nhắn đã bị thu hồi';
      }
      await conversation.save();
    }

    // Broadcast socket event so other users in the conversation know the message was recalled
    if (global.io && conversation) {
      conversation.participants.forEach((participantId) => {
        const pIdStr = String(participantId._id || participantId);
        global.io.to(pIdStr).emit('message_recalled', {
          conversationId: conversation._id,
          messageId: message._id,
        });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Thu hồi tin nhắn thành công',
      data: message,
    });
  } catch (error) {
    console.error('Recall message error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi thu hồi tin nhắn' });
  }
};


