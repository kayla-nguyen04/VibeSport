const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Follow = require('../models/Follow');
const User = require('../models/User');
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

  const myPendingCount = countPendingByUser(conversation, currentId);
  const remainingPending = Math.max(0, MAX_PENDING_PER_USER - myPendingCount);
  const otherPendingMessages = (conversation.pendingMessages || []).filter(
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

  const canChat = isGroup || ((isFriend || hasAccepted) && !blockedByOther);
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
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: getUnreadCount(conversation, currentUserId),
    updatedAt: conversation.updatedAt,
    status: conversation.status,
    isFriend: Boolean(isGroup || isFriend),
    isPending: !isGroup && (!hasAccepted && hasOtherPendingRequest),
    isMyPendingRequest: !isGroup && isMyPendingRequest,
    hasOtherPendingRequest: !isGroup && hasOtherPendingRequest,
    myPendingCount: !isGroup ? myPendingCount : 0,
    remainingPendingMessages: !isGroup ? remainingPending : 0,
    otherPendingMessages: !isGroup ? otherPendingMessages : [],
    pendingMessages: !isGroup ? (conversation.pendingMessages || []) : [],
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
  };
}

exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId })
      .populate('participants', USER_SELECT)
      .populate('pendingMessages.senderId', USER_SELECT)
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
    const participantKey = allParticipants.map((id) => String(id)).sort().join('_');

    let conversation = await Conversation.findOne({ participantKey }).populate('participants', USER_SELECT);

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
      });
      conversation = await Conversation.findById(conversation._id).populate('participants', USER_SELECT);
    } else {
      if (!isGroup) {
        const isFriend = await areMutualFriends(req.userId, uniqueIds[0]);
        if (isFriend && conversation.status !== 'active') {
          conversation.status = 'active';
          conversation.pendingMessages = [];
          await conversation.save();
          conversation = await Conversation.findById(conversation._id).populate('participants', USER_SELECT);
        }
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

    const messages = await Message.find({ conversationId: id })
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

    const isHidden =
      !isGroup &&
      (isBlockedByMe(conversation, req.userId) ||
        (conversation.deletedByUserIds || []).some((id) => String(id) === String(req.userId)));

    if (isHidden) {
      return res.status(403).json({
        success: false,
        message: 'Cuộc trò chuyện này đã bị ẩn',
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

    // Verify participant
    const isParticipant = conversation.participants.some(
      (p) => String(p._id || p) === String(req.userId)
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa nhóm này' });
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

    // Verify requesting user is a participant
    const isParticipant = conversation.participants.some(
      (p) => String(p) === String(req.userId)
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thêm thành viên vào nhóm này' });
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
        addedCount++;
      }
    });

    if (addedCount > 0) {
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
