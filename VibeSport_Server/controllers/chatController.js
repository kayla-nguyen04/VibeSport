const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');

const USER_SELECT = 'name picture area favoriteSport lastSeenAt';

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

async function getTotalUnreadCount(userId) {
  const conversations = await Conversation.find({ participants: userId }).select('unreadByUser');
  return conversations.reduce((sum, conversation) => sum + getUnreadCount(conversation, userId), 0);
}

async function emitChatUnreadCount(userId) {
  if (!global.io) return;
  const unreadCount = await getTotalUnreadCount(userId);
  global.io.to(String(userId)).emit('unread_messages_count', { unreadCount });
}

async function createMessageNotification({ recipientId, senderId, conversationId, preview }) {
  try {
    const sender = await User.findById(senderId).select('name');
    const senderName = sender?.name || 'Một thành viên';
    const notification = await Notification.create({
      userId: recipientId,
      fromUserId: senderId,
      type: 'message',
      message: `${senderName}: ${preview}`,
      conversationId,
    });

    const populated = await Notification.findById(notification._id)
      .populate('fromUserId', 'name picture')
      .populate('conversationId', 'lastMessage lastMessageAt');

    if (global.io) {
      global.io.to(String(recipientId)).emit('new_notification', populated);
      const unreadCount = await Notification.countDocuments({ userId: recipientId, read: false });
      global.io.to(String(recipientId)).emit('unread_count', { unreadCount });
    }
  } catch (error) {
    console.error('Create message notification error:', error);
  }
}

function formatConversation(conversation, currentUserId) {
  const peer = conversation.participants.find(
    (participant) => String(participant._id) !== String(currentUserId)
  );

  return {
    _id: conversation._id,
    peer: peer
      ? {
          _id: peer._id,
          name: peer.name,
          picture: peer.picture,
          area: peer.area,
          favoriteSport: peer.favoriteSport,
          lastSeenAt: peer.lastSeenAt,
        }
      : null,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: getUnreadCount(conversation, currentUserId),
    updatedAt: conversation.updatedAt,
  };
}

exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId })
      .populate('participants', USER_SELECT)
      .sort({ lastMessageAt: -1 });

    res.status(200).json({
      success: true,
      data: conversations.map((conversation) => formatConversation(conversation, req.userId)),
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
    const { recipientId } = req.body;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Thiếu người nhận' });
    }

    if (String(recipientId) === String(req.userId)) {
      return res.status(400).json({ success: false, message: 'Không thể nhắn tin cho chính mình' });
    }

    const recipient = await User.findById(recipientId).select(USER_SELECT);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const participantKey = buildParticipantKey(req.userId, recipientId);
    let conversation = await Conversation.findOne({ participantKey }).populate('participants', USER_SELECT);

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.userId, recipientId],
        participantKey,
        unreadByUser: {
          [String(req.userId)]: 0,
          [String(recipientId)]: 0,
        },
      });
      conversation = await Conversation.findById(conversation._id).populate('participants', USER_SELECT);
    }

    res.status(200).json({
      success: true,
      data: formatConversation(conversation, req.userId),
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
    if (!conversation || !conversation.participants.some((participantId) => String(participantId) === String(req.userId))) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    const messages = await Message.find({ conversationId: id })
      .populate('senderId', USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: messages.reverse(),
      page,
      limit,
      hasMore: messages.length === limit,
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
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống' });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.participants.some((participantId) => String(participantId) === String(req.userId))) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });
    }

    const recipientId = conversation.participants.find(
      (participantId) => String(participantId) !== String(req.userId)
    );

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
    const preview = trimmedContent.length > 80 ? `${trimmedContent.slice(0, 80)}...` : trimmedContent;

    if (global.io) {
      global.io.to(String(recipientId)).emit('new_message', {
        conversationId: id,
        message: populatedMessage,
        lastMessage: trimmedContent,
        lastMessageAt: conversation.lastMessageAt,
      });
      await emitChatUnreadCount(recipientId);
    }

    await createMessageNotification({
      recipientId,
      senderId: req.userId,
      conversationId: id,
      preview,
    });

    res.status(201).json({
      success: true,
      data: populatedMessage,
      conversation: formatConversation(
        await Conversation.findById(id).populate('participants', USER_SELECT),
        req.userId
      ),
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gửi tin nhắn' });
  }
};

exports.markConversationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation || !conversation.participants.some((participantId) => String(participantId) === String(req.userId))) {
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
