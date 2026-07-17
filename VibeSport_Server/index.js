require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

// Fix DNS querySrv ECONNREFUSED/ENOTFOUND on Windows when resolving MongoDB Atlas SRV records
if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {
    // Fallback if dns.setServers fails or is restricted
  }
}

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { Server } = require('socket.io');

const authRouter = require('./routes/auth');
const agoraRouter = require('./routes/agora');
const otpRoutes = require("./routes/otp");
const matchRoutes = require("./routes/matches");
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
const seedTags = require('./scripts/seedTags');
const { startMatchNotificationCron } = require('./utils/matchNotificationCron');
const { sendSystemCallMessage } = require('./controllers/chatController');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// ================================
// Socket.IO authentication middleware
// Verify token from handshake auth, set socket.data.userId server-side
// ================================
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

// ================================
// Agora channel participant tracking
// Key: channelName → Set of Agora uids (int)
// ================================
const MAX_PARTICIPANTS_PER_CHANNEL = 8;

// Key: channelName → Date (last user join time)
// Cập nhật MỖI LẦN có user join, xóa khi channel empty
const lastJoinTimes = new Map();

// Key: channelName → { conversationId, callType, callerId, timerId }
// Lưu cuộc gọi đang chờ (start_call gửi rồi nhưng chưa ai join)
// Dùng cho: call_rejected / call_busy / timeout 30s
// timerId để cancel timeout khi người nhận nhấc máy
const pendingCalls = new Map();

// Key: channelName → callType ('audio' | 'video')
// Lưu callType ngay khi cuộc gọi được nhấc máy thành công (join_channel_request)
// Dùng trong handleLeaveChannel thay vì phụ thuộc client payload
const activeCallTypes = new Map();

// Key: userId (string) → 'pending' | 'active'
// 'pending': user có incoming call chưa trả lời (đang rung chuông)
// 'active':  user đang trong cuộc gọi đã kết nối
// Dùng để server chặn cuộc gọi thứ 2 ngay lập tức, không cần đợi client phản hồi
const busyUsers = new Map();

const channelParticipants = new Map(); // { channelName -> Set(uid) }

function getChannelParticipantCount(channelName) {
  return channelParticipants.get(channelName)?.size ?? 0;
}

function addParticipant(channelName, uid) {
  if (!channelParticipants.has(channelName)) {
    channelParticipants.set(channelName, new Set());
  }
  channelParticipants.get(channelName).add(uid);
}

function removeParticipant(channelName, uid) {
  channelParticipants.get(channelName)?.delete(uid);
  if (channelParticipants.get(channelName)?.size === 0) {
    channelParticipants.delete(channelName);
    // Clean up orphaned call state when channel becomes empty
    lastJoinTimes.delete(channelName);
    pendingCalls.delete(channelName);
    activeCallTypes.delete(channelName);
  }
}

function isChannelFull(channelName) {
  return getChannelParticipantCount(channelName) >= MAX_PARTICIPANTS_PER_CHANNEL;
}

/**
 * Xử lý khi một user rời khỏi channel.
 * Dùng chung cho: leave_channel event VÀ disconnect event.
 * @param {object} socket - Socket.IO socket instance
 * @param {string} channelName
 * @param {string|null} callTypeFallback - fallback từ client payload (leave_channel)
 *                                      disconnect không có payload → truyền null
 */
async function handleLeaveChannel(socket, channelName, callTypeFallback) {
  const agoraUid = socket.data?.agoraUid;
  const userId = socket.data?.userId;
  if (!agoraUid) return;
  console.log('[SOCKET] handleLeaveChannel:', { channelName, agoraUid });

  // Kiểm tra user có trong channel không (an toàn cho disconnect race condition)
  const participants = channelParticipants.get(channelName);
  if (!participants || !participants.has(agoraUid)) return;

  // Xóa khỏi channel
  removeParticipant(channelName, agoraUid);
  io.to(channelName).emit('user_left_channel', { channelName, agoraUid });
  socket.leave(channelName);

  // Xóa currentChannel trên socket
  if (socket.data.currentChannel === channelName) {
    socket.data.currentChannel = null;
  }

  // Xóa busyUsers khi rời cuộc gọi active
  if (userId && busyUsers.get(userId) === 'active') {
    busyUsers.delete(userId);
    console.log(`[SOCKET] busyUsers.delete(${userId}) — left active call`);
  }

  // Gửi tin nhắn "cuộc gọi kết thúc" CHỈ khi người CUỐI CÙNG rời
  if (lastJoinTimes.has(channelName)) {
    const countAfterRemove = channelParticipants.get(channelName)?.size ?? 0;
    if (countAfterRemove === 0) {
      const startTime = lastJoinTimes.get(channelName);
      const convId = channelName?.match(/^call_(.+)$/)?.[1];
      // Ưu tiên activeCallTypes (server-side, chính xác), fallback về callType client gửi
      const callType = activeCallTypes.get(channelName) ?? callTypeFallback;
      if (startTime && convId && callType) {
        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        try {
          await sendSystemCallMessage(convId, callType, durationSeconds);
          console.log(`[SOCKET] Call ended message sent for ${channelName} (${durationSeconds}s)`);
        } catch (err) {
          console.error('[SOCKET] sendSystemCallMessage error:', err);
        }
      }
      lastJoinTimes.delete(channelName);
    }
  }
}

/**
 * Xoá busyUsers cho tất cả user liên quan đến 1 channel.
 * Dùng chung cho call_busy / call_rejected / call_cancelled / timeout /
 * disconnect để đảm bảo không có user nào bị "kẹt" state 'pending' hoặc
 * 'active' sau khi cuộc gọi kết thúc bằng mọi lý do.
 *
 * @param {string} channelName
 * @param {string} [reason]   - log tag để debug
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
  if (cleared > 0) {
    console.log(`[SOCKET] clearBusyForChannel(${channelName}, ${reason}) — cleared ${cleared} user(s)`);
  }
  return cleared;
}

// Setup Socket.IO global reference
global.io = io;

io.on('connection', (socket) => {
  console.log('[SOCKET] Client connected:', socket.id);

  // Helper: chuyển ObjectId string → agoraUid int32
  function toAgoraUid(userId) {
    if (!userId || typeof userId !== 'string' || userId.length < 24) return 0;
    const hex = userId.slice(-8);
    const uid = parseInt(hex, 16) % 2147483647;
    return uid === 0 ? 1 : uid;
  }

  socket.on('join', () => {
    // socket.data.userId đã được io.use() middleware gán từ token đã verify
    const userId = socket.data.userId;
    if (userId) {
      socket.join(userId.toString());
      socket.data.agoraUid = toAgoraUid(userId);
      console.log(`[SOCKET] User ${userId} joined room ${userId} (agoraUid=${socket.data.agoraUid})`);
    }
  });

  // ================================
  // Agora call signaling via Socket.IO
  // ================================

  // User A gọi User B hoặc nhóm
  // payload: { peerId, channelName, callType, isGroup, callerId, callerName, memberIds }
  //   - peerId: string | null (peer id khi 1-1, null khi group)
  //   - memberIds: string[] (danh sách user id thành viên nhóm, bỏ qua caller)
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

    console.log('[SOCKET] start_call:', payload);

    // Lưu pending call để call_rejected/call_busy/timeout có thể gửi tin nhắn "Cuộc gọi nhỡ"
    const conversationId = channelName?.match(/^call_(.+)$/)?.[1];
    if (conversationId) {
      // Cancel timer cũ nếu có (channelName trùng giữa các cuộc gọi trong cùng conversation)
      const existing = pendingCalls.get(channelName);
      if (existing) {
        clearTimeout(existing.timerId);
      }
      const timerId = setTimeout(async () => {
        // ATOMIC: lấy + xóa NGAY để prevent race với call_rejected/call_busy
        const pending = pendingCalls.get(channelName);
        pendingCalls.delete(channelName);
        if (!pending) return;

        clearBusyForChannel(channelName, 'timeout (30s)');
        try {
          await sendSystemCallMessage(pending.conversationId, pending.callType, 0, true);
          console.log(`[SOCKET] Missed call (timeout) message sent for ${channelName}`);
        } catch (err) {
          console.error('[SOCKET] sendSystemCallMessage (missed/timeout) error:', err);
        }
      }, 30000);
      const targetIds = isGroup
        ? memberIds.filter((id) => String(id) !== String(callerId)).map(String)
        : peerId ? [String(peerId)] : [];
      pendingCalls.set(channelName, { conversationId, callType, callerId, timerId, targetIds });
      console.log(`[SOCKET] pendingCalls.set for ${channelName} (timeout=30s, targetIds=${targetIds.length})`);
    }

    if (isGroup) {
      // Mời tất cả thành viên trong nhóm (trừ caller) + đánh dấu busy
      const targets = memberIds.filter((id) => String(id) !== String(callerId));
      console.log(`[SOCKET] Group call to ${targets.length} members in channel ${channelName}`);
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
        });
      }
    } else if (peerId) {
      // 1-1 call: kiểm tra B có đang bận không TRƯỚC KHI emit incoming_call
      const peerBusyState = busyUsers.get(peerId.toString());
      if (peerBusyState) {
        console.log(`[SOCKET] start_call BLOCKED — peer ${peerId} is busy (${peerBusyState})`);
        io.to(callerId.toString()).emit('call_busy', { channelName });
        // Cleanup pendingCalls entry đã tạo phía trên
        // ATOMIC: lấy + xóa NGAY để prevent race với timeout callback
        const pendingEntry = pendingCalls.get(channelName);
        pendingCalls.delete(channelName);
        if (pendingEntry) {
          clearTimeout(pendingEntry.timerId);
          // Gửi tin nhắn "Cuộc gọi nhỡ" sau khi atomic delete — tránh timeout gửi trùng
          try {
            await sendSystemCallMessage(pendingEntry.conversationId, pendingEntry.callType, 0, true);
            console.log(`[SOCKET] Missed call (peer busy) message sent for ${channelName}`);
          } catch (err) {
            console.error('[SOCKET] sendSystemCallMessage (missed/peer-busy) error:', err);
          }
        }
        return;
      }
      // 1-1 call: forward tới đúng peer + đánh dấu B là pending
      busyUsers.set(peerId.toString(), 'pending');
      console.log(`[SOCKET] busyUsers.set(${peerId}) = pending`);
      io.to(peerId.toString()).emit('incoming_call', {
        channelName,
        callType,
        isGroup: false,
        callerId,
        callerName,
      });
    }
  });

  // Người nhận bấm "Nhận" → gửi yêu cầu join channel
  // Dùng Socket.IO acknowledgement callback thay vì emit event riêng
  // Lấy agoraUid từ socket.data (server-side), KHÔNG tin client gửi lên
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

    // Extract conversationId từ channelName (dạng call_<conversationId>)
    const match = channelName?.match(/^call_(.+)$/);
    if (!match) {
      ackFn({ ok: false, reason: 'invalid_channel' });
      console.warn('[SOCKET] join_channel_request: invalid channelName format');
      return;
    }
    const conversationId = match[1];

    // Kiểm tra quyền: user phải là participant của conversation đó
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

        // Kiểm tra giới hạn số người
        if (isChannelFull(channelName)) {
          ackFn({ ok: false, reason: 'full', maxParticipants: MAX_PARTICIPANTS_PER_CHANNEL });
          console.log(`[SOCKET] Channel ${channelName} full`);
          return;
        }

        // Tất cả kiểm tra qua — cho phép join
        addParticipant(channelName, agoraUid);
        socket.join(channelName);
        socket.data.currentChannel = channelName; // track để cleanup khi disconnect

        // Ghi nhận thời điểm join (cập nhật mỗi lần có user join)
        lastJoinTimes.set(channelName, Date.now());

        // Chuyển trạng thái busy: 'pending' → 'active'
        const userId = socket.data.userId;
        if (userId && busyUsers.get(userId) === 'pending') {
          busyUsers.set(userId, 'active');
          console.log(`[SOCKET] busyUsers(${userId}): pending → active`);
        }

        // Người nhận nhấc máy → cuộc gọi được kết nối
        // Cancel timeout timer và xóa pendingCalls để tránh gửi "Cuộc gọi nhỡ" sau này
        const pending = pendingCalls.get(channelName);
        if (pending) {
          clearTimeout(pending.timerId);
          pendingCalls.delete(channelName);
          // Lưu callType server-side để dùng trong handleLeaveChannel (disconnect-safe)
          activeCallTypes.set(channelName, pending.callType);
          console.log(`[SOCKET] pendingCalls cleared + activeCallTypes.set for ${channelName} (call answered)`);

          // Báo cho các member KHÔNG bắt máy: cuộc gọi đã được người khác nhận
          for (const tid of pending.targetIds ?? []) {
            if (String(tid) === String(userId)) continue; // skip chính mình
            if (busyUsers.get(tid) === 'pending') {
              busyUsers.delete(tid);
              console.log(`[SOCKET] busyUsers.delete(${tid}) — call_answered_elsewhere (another member answered)`);
            }
            io.to(tid).emit('call_answered_elsewhere', { channelName });
          }
        }

        ackFn({ ok: true });
        console.log(
          `[SOCKET] User ${agoraUid} joined channel ${channelName}` +
          ` (${getChannelParticipantCount(channelName)}/${MAX_PARTICIPANTS_PER_CHANNEL})`
        );
        io.to(channelName).emit('user_joined_channel', { channelName, agoraUid });
      })
      .catch((err) => {
        console.error('[SOCKET] join_channel_request DB error:', err);
        ackFn({ ok: false, reason: 'server_error' });
      });
  });

  // Người rời khỏi channel (bấm kết thúc hoặc tắt app)
  // Lấy agoraUid từ socket.data — KHÔNG tin client gửi
  socket.on('leave_channel', async ({ channelName, callType }, ackFn) => {
    console.log('[SOCKET] leave_channel:', { channelName, callType });
    await handleLeaveChannel(socket, channelName, callType);
    if (typeof ackFn === 'function') ackFn({ ok: true });
  });

  // User B đang bận → thông báo lại cho A + gửi tin nhắn "Cuộc gọi nhỡ" cho caller
  // ─── Auth guard: chỉ callee/target mới được emit call_busy / call_rejected ───
  function getAuthGuard(channelName, calleeId, eventName) {
    const pending = pendingCalls.get(channelName);
    if (!pending) {
      console.warn(`[SOCKET] ${eventName}/auth: no pending call for channel ${channelName}`);
      return false;
    }
    const isGroup = pending.targetIds?.length > 0;
    const myId = socket.data.userId;

    if (isGroup) {
      // Group call: người emit phải nằm trong danh sách target đang được mời
      if (!pending.targetIds.includes(myId)) {
        console.warn(`[SOCKET] ${eventName}/auth: user ${myId} not in targetIds for channel ${channelName}`);
        return false;
      }
    } else {
      // 1-1 call: người emit phải trùng với calleeId trong payload
      if (!calleeId || String(myId) !== String(calleeId)) {
        console.warn(`[SOCKET] ${eventName}/auth: callee mismatch — myId=${myId}, calleeId=${calleeId}`);
        return false;
      }
    }
    return true;
  }

  socket.on('call_busy', async ({ callerId: callerIdPayload, channelName, calleeId }) => {
    if (!getAuthGuard(channelName, calleeId, 'call_busy')) return;
    console.log('[SOCKET] call_busy:', { callerId: callerIdPayload, channelName, calleeId });
    const pending = pendingCalls.get(channelName);

    // Dùng callerId từ payload nếu có; fallback về callerId đã lưu lúc start_call
    const callerId = callerIdPayload || pending?.callerId;

    // Xóa busyUsers cho tất cả target đang pending trong group call
    if (pending?.targetIds?.length) {
      clearBusyForChannel(channelName, 'call_busy (group)');
      for (const tid of pending.targetIds) {
        io.to(tid).emit('call_busy', { channelName });
      }
    } else if (calleeId) {
      // 1-1 call: giữ nguyên logic cũ
      const key = calleeId.toString();
      if (busyUsers.get(key) === 'pending') {
        busyUsers.delete(key);
        console.log(`[SOCKET] busyUsers.delete(${calleeId}) — callee busy`);
      }
      io.to(key).emit('call_busy', { channelName });
    }

    if (callerId) {
      io.to(callerId.toString()).emit('call_busy', { channelName });
    }

    // Gửi tin nhắn "Cuộc gọi nhỡ" cho caller (không ai nhận)
    // ATOMIC: lấy + xóa NGAY để prevent race với timeout callback
    const pendingToSend = pendingCalls.get(channelName);
    pendingCalls.delete(channelName);
    if (pendingToSend) {
      clearTimeout(pendingToSend.timerId);
      try {
        await sendSystemCallMessage(pendingToSend.conversationId, pendingToSend.callType, 0, true);
        console.log(`[SOCKET] Missed call (busy) message sent for ${channelName}`);
      } catch (err) {
        console.error('[SOCKET] sendSystemCallMessage (missed/busy) error:', err);
      }
    }
  });

  // User B từ chối → thông báo lại cho A + gửi tin nhắn "Cuộc gọi nhỡ" cho caller
  socket.on('call_rejected', async ({ callerId: callerIdPayload, channelName, calleeId }) => {
    if (!getAuthGuard(channelName, calleeId, 'call_rejected')) return;
    console.log('[SOCKET] call_rejected:', { callerId: callerIdPayload, channelName, calleeId });
    const pending = pendingCalls.get(channelName);

    // Dùng callerId từ payload nếu có; fallback về callerId đã lưu lúc start_call
    const callerId = callerIdPayload || pending?.callerId;

    // Xóa busyUsers + notify tất cả target đang pending trong group call
    if (pending?.targetIds?.length) {
      clearBusyForChannel(channelName, 'call_rejected (group)');
      for (const tid of pending.targetIds) {
        io.to(tid).emit('call_rejected', { channelName });
      }
    } else if (calleeId) {
      // 1-1 call: giữ nguyên logic cũ
      const key = calleeId.toString();
      if (busyUsers.get(key) === 'pending') {
        busyUsers.delete(key);
        console.log(`[SOCKET] busyUsers.delete(${calleeId}) — callee rejected`);
      }
      io.to(key).emit('call_rejected', { channelName });
    }

    if (callerId) {
      io.to(callerId.toString()).emit('call_rejected', { channelName });
    }

    // Gửi tin nhắn "Cuộc gọi nhỡ" cho caller (không ai nhận)
    // ATOMIC: lấy + xóa NGAY để prevent race với timeout callback
    const pendingToSend = pendingCalls.get(channelName);
    pendingCalls.delete(channelName);
    if (pendingToSend) {
      clearTimeout(pendingToSend.timerId);
      try {
        await sendSystemCallMessage(pendingToSend.conversationId, pendingToSend.callType, 0, true);
        console.log(`[SOCKET] Missed call (rejected) message sent for ${channelName}`);
      } catch (err) {
        console.error('[SOCKET] sendSystemCallMessage (missed/rejected) error:', err);
      }
    }
  });

  // User A hủy trước khi B nhận → thông báo B + cleanup pendingCalls + busyUsers
  socket.on('call_cancelled', ({ peerId, channelName }) => {
    console.log('[SOCKET] call_cancelled:', { peerId, channelName });
    const pending = pendingCalls.get(channelName);

    // Notify tất cả target đang pending trong group call
    if (pending?.targetIds?.length) {
      clearBusyForChannel(channelName, 'call_cancelled (group)');
      for (const tid of pending.targetIds) {
        io.to(tid).emit('call_cancelled', { channelName });
      }
    } else if (peerId) {
      // 1-1 call: giữ nguyên logic cũ
      const key = peerId.toString();
      if (busyUsers.get(key) === 'pending') {
        busyUsers.delete(key);
      }
      io.to(key).emit('call_cancelled', { channelName });
    }

    if (pending) {
      clearTimeout(pending.timerId);
      pendingCalls.delete(channelName);
    }
  });

  // Khi socket bị disconnect → cleanup channel
  socket.on('disconnect', () => {
    console.log('[SOCKET] Client disconnected:', socket.id);
    const uidOnDisconnect = socket.data?.agoraUid;
    const currentChannel = socket.data?.currentChannel;
    const userIdOnDisconnect = socket.data?.userId;

    // 1. Xóa busyUsers nếu user disconnect trong trạng thái pending/active
    if (userIdOnDisconnect) {
      busyUsers.delete(userIdOnDisconnect.toString());
    }

    // 2. Xử lý channel hiện tại (nếu có)
    if (currentChannel && uidOnDisconnect) {
      // callType không có trong disconnect → truyền null
      handleLeaveChannel(socket, currentChannel, null);
    }

    // 2. Cleanup dangling participant entries (phòng trường hợp join không qua join_channel_request)
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
app.use('/api/agora', agoraRouter);
app.use("/api/otp", otpRoutes);
app.use("/api/matches", matchRoutes);

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


mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedTags();
    console.log('Tag catalog ready');

    // Clean up Mojibake lastMessage records in database
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

