require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {
  }
}

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { Server } = require('socket.io');
const ratingRoutes = require('./routes/ratingRoutes');
const courtRatingRoutes = require('./routes/courtRatingRoutes');
const authRouter = require('./routes/auth');
const agoraRouter = require('./routes/agora');
const otpRoutes = require("./routes/otp");
const matchRoutes = require("./routes/matches");
const virtualUserRoutes = require("./routes/virtualUserRoutes");
const postsRouter = require('./routes/posts');
const savedPostsRouter = require('./routes/savedPosts');
const tagsRouter = require('./routes/tags');
const usersRouter = require('./routes/users');
const notificationsRouter = require('./routes/notifications');
const chatRouter = require('./routes/chat');
const tasksRouter = require('./routes/tasks');
const adminUsersRouter = require('./routes/adminUsers');
const Conversation = require('./models/Conversation');
const Session = require('./models/Session');
const Follow = require('./models/Follow');
const fcRouter = require('./routes/fc');
const seedTags = require('./scripts/seedTags');
const aiRoutes = require('./routes/aiRoutes');
const { startMatchNotificationCron } = require('./utils/matchNotificationCron');
const { sendSystemCallMessage } = require('./controllers/chatController');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('unauthorized: no token'));
    }

    const session = await Session.findOne({ token }).populate('userId');
    if (!session || !session.userId) {
      return next(new Error('unauthorized: invalid or expired token'));
    }

    socket.data.userId = session.userId._id.toString();
    next();
  } catch (err) {
    console.error('[SOCKET] auth middleware error:', err);
    next(new Error('unauthorized: server error'));
  }
});
const MAX_PARTICIPANTS_PER_CHANNEL = 8;

const lastJoinTimes = new Map();
const callStartTimes = new Map();
const pendingCalls = new Map();
const activeCallTypes = new Map();
const busyUsers = new Map();

const channelParticipants = new Map(); 

function getChannelParticipantCount(channelName) {
  return channelParticipants.get(channelName)?.size ?? 0;
}

function addParticipant(channelName, uid) {
  if (!channelParticipants.has(channelName)) {
    channelParticipants.set(channelName, new Set());
  }
  channelParticipants.get(channelName).add(uid);
}

const peakParticipants = new Map();

function updatePeakParticipants(channelName) {
  const current = channelParticipants.get(channelName)?.size ?? 0;
  const peak = peakParticipants.get(channelName) ?? 0;
  if (current > peak) {
    peakParticipants.set(channelName, current);
  }
}

const callCallerIds = new Map();

function removeParticipant(channelName, uid) {
  channelParticipants.get(channelName)?.delete(uid);
  if (channelParticipants.get(channelName)?.size === 0) {
    channelParticipants.delete(channelName);
    lastJoinTimes.delete(channelName);
    callStartTimes.delete(channelName);
    pendingCalls.delete(channelName);
    activeCallTypes.delete(channelName);
    peakParticipants.delete(channelName);
    callCallerIds.delete(channelName);
  }
}

function isChannelFull(channelName) {
  return getChannelParticipantCount(channelName) >= MAX_PARTICIPANTS_PER_CHANNEL;
}

/**
 * Xử lý khi một user rời khỏi channel.
 * Dùng chung cho: leave_channel event VÀ disconnect event.
 * @param {object} socket 
 * @param {string} channelName
 * @param {string|null} callTypeFallback 
 *                                      
 */
async function handleLeaveChannel(socket, channelName, callTypeFallback) {
  const agoraUid = socket.data?.agoraUid;
  const userId = socket.data?.userId;
  if (!agoraUid) return;

  const participants = channelParticipants.get(channelName);
  if (!participants || !participants.has(agoraUid)) return;

  const startTime = callStartTimes.get(channelName) ?? lastJoinTimes.get(channelName);
  const callType = activeCallTypes.get(channelName) ?? callTypeFallback;
  const durationSeconds = startTime
    ? Math.max(0, Math.floor((Date.now() - startTime) / 1000))
    : 0;
  
  const peak = peakParticipants.get(channelName) ?? 0;

  const callerId = callCallerIds.get(channelName) ?? null;

  removeParticipant(channelName, agoraUid);
  io.to(channelName).emit('user_left_channel', { channelName, agoraUid });
  socket.leave(channelName);

  if (socket.data.currentChannel === channelName) {
    socket.data.currentChannel = null;
  }

  if (userId && busyUsers.get(userId) === 'active') {
    busyUsers.delete(userId);
  }

  const countAfterRemove = channelParticipants.get(channelName)?.size ?? 0;

  if (countAfterRemove > 0) {
    const convId = channelName?.match(/^call_(.+)$/)?.[1];
    io.to(channelName).emit('call_ended', {
      channelName,
      callType,
      durationSeconds,
      endedBy: userId,
      conversationId: convId,
    });
  }

  if (countAfterRemove === 0 && peak > 1) {
    const convId = channelName?.match(/^call_(.+)$/)?.[1];
    if (startTime && convId && callType) {
      try {
        await sendSystemCallMessage(convId, callType, durationSeconds, false, callerId);
      } catch (err) {
        console.error('[SOCKET] sendSystemCallMessage error:', err);
      }
    }
  }
}

/**
 * 
 *
 * @param {string} channelName
 * @param {string} [reason]   
 */
function clearBusyForChannel(channelName, reason = 'cleared') {
  const pending = pendingCalls.get(channelName);
  const targetIds = pending?.targetIds ?? [];
  if (targetIds.length === 0) return 0;
  let cleared = 0;
  for (const tid of targetIds) {
    const key = tid.toString();
    if (busyUsers.has(key)) {
      busyUsers.delete(key);
      cleared += 1;
    }
  }
  return cleared;
}

global.io = io;

io.on('connection', (socket) => {
  console.log('[SOCKET] Client connected:', socket.id);

  function toAgoraUid(userId) {
    if (!userId || typeof userId !== 'string' || userId.length < 24) return 0;
    const hex = userId.slice(-8);
    const uid = parseInt(hex, 16) % 2147483647;
    return uid === 0 ? 1 : uid;
  }

  socket.on('join', () => {
    const userId = socket.data.userId;
    if (userId) {
      socket.join(userId.toString());
      socket.data.agoraUid = toAgoraUid(userId);
      console.log(`[SOCKET] User ${userId} joined room ${userId} (agoraUid=${socket.data.agoraUid})`);
    }
  });


  socket.on('start_call', async (payload) => {
    const {
      peerId,
      channelName,
      callType,
      isGroup,
      callerId,
      callerName,
      memberIds = [],
    } = payload;

    const conversationId = channelName?.match(/^call_(.+)$/)?.[1];
    if (conversationId) {
      const existing = pendingCalls.get(channelName);
      if (existing) {
        clearTimeout(existing.timerId);
      }
      const timerId = setTimeout(async () => {
        const pending = pendingCalls.get(channelName);
        pendingCalls.delete(channelName);
        if (!pending) return;

        clearBusyForChannel(channelName, 'timeout (30s)');

        if (pending.callerId) {
          io.to(pending.callerId.toString()).emit('call_rejected', { channelName, reason: 'timeout' });
        }

        try {
          await sendSystemCallMessage(pending.conversationId, pending.callType, 0, true, pending.callerId);
        } catch (err) {
          console.error('[SOCKET] sendSystemCallMessage (missed/timeout) error:', err);
        }
      }, 30000);
      const targetIds = isGroup
        ? memberIds.filter((id) => String(id) !== String(callerId)).map(String)
        : peerId ? [String(peerId)] : [];
      pendingCalls.set(channelName, { conversationId, callType, callerId, timerId, targetIds });
      callCallerIds.set(channelName, String(callerId));
    }

    if (isGroup) {
      const targets = memberIds.filter((id) => String(id) !== String(callerId));

      let groupName = null;
      if (conversationId) {
        try {
          const conv = await Conversation.findById(conversationId)
            .select('name isGroup')
            .lean();
          if (conv && conv.isGroup && conv.name) {
            groupName = conv.name;
          }
        } catch (err) {
          console.warn('[SOCKET] start_call: failed to fetch conversation name for groupName:', err?.message);
        }
      }
      for (const targetId of targets) {
        const key = targetId.toString();
        const busyState = busyUsers.get(key);
        if (busyState === 'active' || busyState === 'pending') {
          console.log(`[SOCKET] start_call BLOCKED for ${key} — busy state=${busyState}`);
          io.to(callerId.toString()).emit('call_busy', { channelName, calleeId: key });
          continue;
        }
        busyUsers.set(key, 'pending');
        io.to(key).emit('incoming_call', {
          channelName,
          callType,
          isGroup: true,
          callerId,
          callerName,
          groupName,
        });
      }
    } else if (peerId) {
      const peerBusyState = busyUsers.get(peerId.toString());
      if (peerBusyState) {
        console.log(`[SOCKET] start_call BLOCKED — peer ${peerId} is busy (${peerBusyState})`);
        io.to(callerId.toString()).emit('call_busy', { channelName });
        const pendingEntry = pendingCalls.get(channelName);
        pendingCalls.delete(channelName);
        if (pendingEntry) {
          clearTimeout(pendingEntry.timerId);
          try {
            await sendSystemCallMessage(pendingEntry.conversationId, pendingEntry.callType, 0, true, pendingEntry.callerId);
          } catch (err) {
            console.error('[SOCKET] sendSystemCallMessage (missed/peer-busy) error:', err);
          }
        }
        return;
      }
      const [aFollowsB, bFollowsA] = await Promise.all([
        Follow.exists({ followerId: callerId, followingId: peerId }),
        Follow.exists({ followerId: peerId, followingId: callerId }),
      ]);
      if (!aFollowsB || !bFollowsA) {
        console.log(`[SOCKET] start_call BLOCKED — not_mutual_follow`, {
          callerId,
          peerId,
          aFollowsB: !!aFollowsB,
          bFollowsA: !!bFollowsA,
        });
        const pendingEntry = pendingCalls.get(channelName);
        pendingCalls.delete(channelName);
        if (pendingEntry) clearTimeout(pendingEntry.timerId);
        io.to(callerId.toString()).emit('call_rejected', {
          channelName,
          reason: 'not_following',
          message: 'Hai bên cần follow lẫn nhau để gọi thoại/video.',
        });
        return;
      }

      busyUsers.set(peerId.toString(), 'pending');
      io.to(peerId.toString()).emit('incoming_call', {
        channelName,
        callType,
        isGroup: false,
        callerId,
        callerName,
      });
    }
  });

  socket.on('join_channel_request', ({ channelName }, ackFn) => {
    if (typeof ackFn !== 'function') {
      console.warn('[SOCKET] join_channel_request: ackFn missing');
      return;
    }

    const agoraUid = socket.data?.agoraUid;
    if (!agoraUid) {
      ackFn({ ok: false, reason: 'unauthorized' });
      console.warn('[SOCKET] join_channel_request: no agoraUid on socket');
      return;
    }

    const match = channelName?.match(/^call_(.+)$/);
    if (!match) {
      ackFn({ ok: false, reason: 'invalid_channel' });
      console.warn('[SOCKET] join_channel_request: invalid channelName format');
      return;
    }
    const conversationId = match[1];

    Conversation.findById(conversationId)
      .select('participants')
      .lean()
      .then((conv) => {
        if (!conv) {
          ackFn({ ok: false, reason: 'not_found' });
          return;
        }
        const isParticipant = conv.participants.some(
          (p) => p.toString() === socket.data.userId
        );
        if (!isParticipant) {
          ackFn({ ok: false, reason: 'forbidden' });
          console.log(`[SOCKET] join_channel_request forbidden: user ${socket.data.userId} not in conv ${conversationId}`);
          return;
        }

        if (isChannelFull(channelName)) {
          ackFn({ ok: false, reason: 'full', maxParticipants: MAX_PARTICIPANTS_PER_CHANNEL });
          console.log(`[SOCKET] Channel ${channelName} full`);
          return;
        }

        const userId = socket.data.userId;
        const isFirstJoinInChannel = !callStartTimes.has(channelName);
        addParticipant(channelName, agoraUid);
        updatePeakParticipants(channelName);
        socket.join(channelName);
        socket.data.currentChannel = channelName;

        lastJoinTimes.set(channelName, Date.now());

        if (isFirstJoinInChannel) {
          callStartTimes.set(channelName, Date.now());
        }

        const pending = pendingCalls.get(channelName);

        const isCallerSelfJoin =
          pending &&
          pending.callerId &&
          String(pending.callerId) === String(userId);

        if (isCallerSelfJoin) {
          ackFn({ ok: true });
          io.to(channelName).emit('user_joined_channel', { channelName, agoraUid });
          return;
        }

        if (busyUsers.get(userId) === 'pending') {
          busyUsers.set(userId, 'active');
        }

        if (pending) {
          clearTimeout(pending.timerId);
          pendingCalls.delete(channelName);
          activeCallTypes.set(channelName, pending.callType);

          for (const tid of pending.targetIds ?? []) {
            if (String(tid) === String(userId)) continue;
            if (busyUsers.get(tid) === 'pending') {
              busyUsers.delete(tid);
            }
            io.to(tid).emit('call_answered_elsewhere', { channelName });
          }
        }

        ackFn({ ok: true });
        io.to(channelName).emit('user_joined_channel', { channelName, agoraUid });
      })
      .catch((err) => {
        console.error('[SOCKET] join_channel_request DB error:', err);
        ackFn({ ok: false, reason: 'server_error' });
      });
  });

  socket.on('leave_channel', async ({ channelName, callType }, ackFn) => {
    await handleLeaveChannel(socket, channelName, callType);
    if (typeof ackFn === 'function') ackFn({ ok: true });
  });

  function getAuthGuard(channelName, calleeId, eventName) {
    const pending = pendingCalls.get(channelName);
    if (!pending) {
      console.warn(`[SOCKET] ${eventName}/auth: no pending call for channel ${channelName}`);
      return false;
    }
    const isGroup = pending.targetIds?.length > 0;
    const myId = socket.data.userId;

    if (isGroup) {
      if (!pending.targetIds.includes(myId)) {
        console.warn(`[SOCKET] ${eventName}/auth: user ${myId} not in targetIds for channel ${channelName}`);
        return false;
      }
    } else {
      if (!calleeId || String(myId) !== String(calleeId)) {
        console.warn(`[SOCKET] ${eventName}/auth: callee mismatch — myId=${myId}, calleeId=${calleeId}`);
        return false;
      }
    }
    return true;
  }

  socket.on('call_busy', async ({ callerId: callerIdPayload, channelName, calleeId }) => {
    if (!getAuthGuard(channelName, calleeId, 'call_busy')) return;
    const pending = pendingCalls.get(channelName);

    const callerId = callerIdPayload || pending?.callerId;

    if (pending?.targetIds?.length) {
      clearBusyForChannel(channelName, 'call_busy (group)');
      for (const tid of pending.targetIds) {
        io.to(tid).emit('call_busy', { channelName });
      }
    } else if (calleeId) {
      const key = calleeId.toString();
      if (busyUsers.get(key) === 'pending') {
        busyUsers.delete(key);
      }
      io.to(key).emit('call_busy', { channelName });
    }

    if (callerId) {
      io.to(callerId.toString()).emit('call_busy', { channelName });
    }

    const pendingToSend = pendingCalls.get(channelName);
    pendingCalls.delete(channelName);
    if (pendingToSend) {
      clearTimeout(pendingToSend.timerId);
      try {
        await sendSystemCallMessage(pendingToSend.conversationId, pendingToSend.callType, 0, true, pendingToSend.callerId);
      } catch (err) {
        console.error('[SOCKET] sendSystemCallMessage (missed/busy) error:', err);
      }
    }
  });

  socket.on('call_rejected', async ({ callerId: callerIdPayload, channelName, calleeId, reason }) => {
    if (!getAuthGuard(channelName, calleeId, 'call_rejected')) return;
    const pending = pendingCalls.get(channelName);

    const callerId = callerIdPayload || pending?.callerId;

    if (pending?.targetIds?.length) {
      clearBusyForChannel(channelName, 'call_rejected (group)');
      for (const tid of pending.targetIds) {
        io.to(tid).emit('call_rejected', { channelName, reason });
      }
    } else if (calleeId) {
      const key = calleeId.toString();
      if (busyUsers.get(key) === 'pending') {
        busyUsers.delete(key);
      }
      io.to(key).emit('call_rejected', { channelName, reason });
    }

    if (callerId) {
      io.to(callerId.toString()).emit('call_rejected', { channelName, reason });
    }

    const pendingToSend = pendingCalls.get(channelName);
    pendingCalls.delete(channelName);
    if (pendingToSend) {
      clearTimeout(pendingToSend.timerId);
      try {
        await sendSystemCallMessage(pendingToSend.conversationId, pendingToSend.callType, 0, true, pendingToSend.callerId);
      } catch (err) {
        console.error('[SOCKET] sendSystemCallMessage (missed/rejected) error:', err);
      }
    }
  });

  socket.on('call_cancelled', ({ peerId, channelName }) => {
    const pending = pendingCalls.get(channelName);

    if (pending?.targetIds?.length) {
      clearBusyForChannel(channelName, 'call_cancelled (group)');
      for (const tid of pending.targetIds) {
        io.to(tid).emit('call_cancelled', { channelName });
      }
    } else if (peerId) {
      const key = peerId.toString();
      if (busyUsers.get(key) === 'pending') {
        busyUsers.delete(key);
      }
      io.to(key).emit('call_cancelled', { channelName });
    }

    if (pending) {
      const convId = pending.conversationId;
      const callType = pending.callType;
      const callerId = pending.callerId;
      clearTimeout(pending.timerId);
      pendingCalls.delete(channelName);
      sendSystemCallMessage(convId, callType, 0, true, callerId)
        .catch((err) => console.error('[SOCKET] sendSystemCallMessage (missed/cancelled) error:', err));
    }
  });

  socket.on('disconnect', () => {
    console.log('[SOCKET] Client disconnected:', socket.id);
    const uidOnDisconnect = socket.data?.agoraUid;
    const currentChannel = socket.data?.currentChannel;
    const userIdOnDisconnect = socket.data?.userId;

    if (userIdOnDisconnect) {
      busyUsers.delete(userIdOnDisconnect.toString());
    }

    if (currentChannel && uidOnDisconnect) {
      handleLeaveChannel(socket, currentChannel, null);
    }

    if (uidOnDisconnect) {
      for (const [cn, participants] of channelParticipants.entries()) {
        if (participants.has(uidOnDisconnect) && cn !== currentChannel) {
          console.log(`[SOCKET] disconnect: cleanup dangling participant ${uidOnDisconnect} from ${cn}`);
          removeParticipant(cn, uidOnDisconnect);
          io.to(cn).emit('user_left_channel', { channelName: cn, agoraUid: uidOnDisconnect });
        }
      }
    }
  });
});

const PORT = 4000;
const HOST = '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';

app.use(cors());
// Cho phép upload ảnh đại diện dạng base64 trong JSON (mặc định express chỉ ~100KB)
app.use(express.json({ limit: '10mb' }));

// ĐÃ SỬA: Đăng ký Router Ratings ĐÚNG VỊ TRÍ (sau app.use(express.json()))
app.use('/api/ai', aiRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/court-ratings', courtRatingRoutes);
app.use('/api/agora', agoraRouter);
app.use("/api/otp", otpRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/virtual-users", virtualUserRoutes);

// Đảm bảo thư mục uploads tồn tại trên startup
const uploadsDir = path.join(__dirname, 'uploads', 'posts');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve file static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routes
app.use('/api/posts', postsRouter);
app.use('/api/saved-posts', savedPostsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/users', usersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/fc', fcRouter);
app.use('/api/courts', require('./routes/courts'));
app.use('/api/admin/courts', require('./routes/courts'));
app.use('/api/admin', require('./routes/adminAuth'));
app.use('/api/admin/tasks', tasksRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/growth', require('./routes/growth'));
app.use('/api/admin', require('./routes/adminPosts'));

app.get('/health', (_, response) => {
  response.json({
    ok: true,
    host: HOST,
    port: PORT,
  });
});

// Mount authentication routes
app.use('/auth', authRouter);

// Global error handler to ensure server always returns JSON on errors
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR HANDLER]', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(err?.status || 500).json({ message: err?.message || 'Lỗi máy chủ nội bộ' });
});

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedTags();
    console.log('Tag catalog ready');

    try {
      const Conversation = require('./models/Conversation');
      const result = await Conversation.updateMany(
        { lastMessage: { $regex: 'ð.*Ảnh|\\?.*Ảnh' } },
        { $set: { lastMessage: '📷 Ảnh' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[MIGRATION] Cleaned up ${result.modifiedCount} conversations with Mojibake lastMessage.`);
      }
    } catch (migErr) {
      console.error('[MIGRATION] Error cleaning up Mojibake conversations:', migErr);
    }

    startMatchNotificationCron();
    server.listen(PORT, HOST, () => {
      console.log(`Server listening at http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  });