import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import io from 'socket.io-client';
import { API_BASE_URL } from '../components/constants/api';
import { addNotification, setUnreadCount } from '../redux/notificationSlice';
import {
  fetchChatUnreadCount,
  receiveMessage,
  receivePendingMessage,
  setChatUnreadCount,
  conversationAccepted,
  conversationBlocked,
  conversationUnblocked,
  conversationDeleted,
  pendingMessagesDeletedByOther,
  groupUpdated,
  memberMuted,
  memberUnmuted,
  joinRequestUpdated,
  messageRecalled,
  setIncomingCall,
  clearIncomingCall,
  setActiveCallChannel,
  clearActiveCallChannel,
  setCallError,
  clearCallError,
} from '../redux/chatSlice';
import { safeGoBackFromCall } from '../navigation/navigationRef';

/**
 * Shared emitter cho phép các component khác gửi socket event
 * mà không cần tự kết nối socket riêng.
 * Cách dùng: import { socketEmitter } from './useSocket'; rồi
 *   socketEmitter.emit('event_name', payload);
 */
export const socketEmitter = {
  _socket: null,
  /**
   * Emit socket event, optional acknowledgement callback.
   * Ví dụ: socketEmitter.emit('join_channel_request', payload, (response) => {...});
   */
  emit(event, data, ackFn) {
    if (ackFn) {
      this._socket?.emit(event, data, ackFn);
    } else {
      this._socket?.emit(event, data);
    }
  },
};

export function useSocket() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const activeCallChannel = useSelector((state) => state.chat.activeCallChannel);
  const incomingCall = useSelector((state) => state.chat.incomingCall);
  const socketRef = useRef(null);
  const activeCallChannelRef = useRef(activeCallChannel);
  const incomingCallRef = useRef(incomingCall);

  // Luôn giữ ref mới nhất để socket closure luôn đọc được giá trị mới nhất
  useEffect(() => {
    activeCallChannelRef.current = activeCallChannel;
  }, [activeCallChannel]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const userId = user.id || user._id;
    if (!userId) return;

    console.log('[SOCKET] Connecting to:', API_BASE_URL);
    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: { token },
    });

    socketRef.current = socket;
    socketEmitter._socket = socket;

    socket.on('connect', () => {
      console.log('[SOCKET] Connected with socket ID:', socket.id);
      socket.emit('join');
      dispatch(fetchChatUnreadCount());
    });

    socket.on('connect_error', (err) => {
      console.warn('[SOCKET] Connection rejected:', err.message);
    });

    socket.on('new_notification', (notification) => {
      if (notification?.type === 'message') return;
      console.log('[SOCKET] Received new notification:', notification);
      dispatch(addNotification(notification));
    });

    socket.on('unread_count', ({ unreadCount }) => {
      console.log('[SOCKET] Received unread count:', unreadCount);
      dispatch(setUnreadCount(unreadCount));
    });

    socket.on('new_message', (payload) => {
      dispatch(receiveMessage({ ...payload, currentUserId: userId }));
    });

    socket.on('new_pending_message', (payload) => {
      dispatch(receivePendingMessage({ ...payload, currentUserId: userId }));
    });

    socket.on('unread_messages_count', ({ unreadCount }) => {
      dispatch(setChatUnreadCount(unreadCount));
    });

    socket.on('conversation_accepted', (payload) => {
      dispatch(conversationAccepted({ ...payload, currentUserId: userId }));
    });

    socket.on('conversation_blocked', (payload) => {
      dispatch(conversationBlocked(payload));
    });

    socket.on('conversation_unblocked', (payload) => {
      dispatch(conversationUnblocked(payload));
    });

    socket.on('pending_messages_deleted', (payload) => {
      dispatch(pendingMessagesDeletedByOther(payload));
    });

    socket.on('group_updated', (payload) => {
      dispatch(groupUpdated(payload));
    });

    socket.on('member_muted', (payload) => {
      dispatch(memberMuted(payload));
    });

    socket.on('member_unmuted', (payload) => {
      dispatch(memberUnmuted(payload));
    });

    socket.on('pinned_message', (payload) => {
      dispatch(groupUpdated(payload));
    });

    socket.on('unpinned_message', (payload) => {
      dispatch(groupUpdated(payload));
    });

    socket.on('join_request_approved', (payload) => {
      dispatch(joinRequestUpdated(payload));
    });

    socket.on('join_request_rejected', (payload) => {
      dispatch(joinRequestUpdated(payload));
    });

    socket.on('message_recalled', (payload) => {
      dispatch(messageRecalled(payload));
    });

    // ===== Cuộc gọi Agora =====

    // === Helper chung: cleanup toàn bộ khi cuộc gọi kết thúc từ phía peer ===
    // Dùng cho call_busy / call_rejected / call_cancelled / call_answered_elsewhere
    // / call_ended. Đảm bảo mọi event dẫn tới "cuộc gọi không tiếp tục" đều:
    // 1. Clear redux state (incomingCall, activeCallChannel)
    // 2. Clear refs (activeCallChannelRef, incomingCallRef)
    // 3. safeGoBackFromCall() — pop CallScreen nếu đang ở đó
    //    (safe vì safeGoBackFromCall chỉ goBack nếu route.name === 'Call',
    //     không ảnh hưởng tới các màn hình khác như ChatDetail)
    // 4. Log rõ ràng để verify luồng khi test
    //
    // Khi CallScreen unmount, useEffect cleanup trong CallScreen sẽ tự động:
    //   - emit leave_channel (qua emitLeaveChannelOnce — server xóa khỏi channel)
    //   - useAgoraCall cleanup → engine.leaveChannel() + engine.release()
    // Nên ta KHÔNG cần gọi leaveCall() thủ công ở đây.
    const leaveCallScreen = (reason, payload) => {
      console.log(`[SOCKET] 🚪 leaveCallScreen(${reason}):`, payload);
      // Clear Redux
      dispatch(clearIncomingCall());
      dispatch(clearActiveCallChannel());
      // Clear refs
      activeCallChannelRef.current = null;
      incomingCallRef.current = null;
      // Pop CallScreen (an toàn — chỉ pop nếu đang ở route 'Call')
      const popped = safeGoBackFromCall();
      console.log(`[SOCKET] 🚪 leaveCallScreen(${reason}) done — safeGoBackFromCall returned:`, popped);
    };

    socket.on('incoming_call', (payload) => {
      console.log('[SOCKET] 📞 incoming_call received:', payload);
      const currentUserId = user?.id || user?._id;
      // Nếu đang có cuộc gọi active HOẶC có cuộc gọi đến đang chờ → từ chối ngay
      if (activeCallChannelRef.current || incomingCallRef.current) {
        console.log('[SOCKET] incoming_call BLOCKED — busy:', {
          activeCall: activeCallChannelRef.current,
          incoming: incomingCallRef.current ? incomingCallRef.current.channelName : null,
        });
        socketEmitter.emit('call_busy', {
          callerId: payload.callerId,
          channelName: payload.channelName,
          calleeId: currentUserId,
        });
        return;
      }
      // Không hiện modal nếu chính mình là người gọi
      if (String(payload.callerId) === String(currentUserId)) {
        console.log('[SOCKET] incoming_call ignored — caller is self');
        return;
      }
      console.log('[SOCKET] incoming_call dispatching setIncomingCall:', payload);
      // Cập nhật ref TRƯỚC khi dispatch để chặn ngay các incoming_call kế tiếp
      // trong cùng tick (tránh bug useEffect sync ref trễ → duplicate emit call_busy)
      incomingCallRef.current = payload;
      activeCallChannelRef.current = payload.channelName;
      // Log riêng groupName để debug dễ — payload được dispatch nguyên vẹn
      // nên groupName đã đi vào Redux qua setIncomingCall(payload).
      if (payload?.isGroup) {
        console.log('[SOCKET] incoming_call GROUP variant — groupName =', payload.groupName ?? '(null/missing)');
      }
      dispatch(setIncomingCall(payload));
      dispatch(setActiveCallChannel(payload.channelName));
    });

    // Caller nhận khi người kia đang bận (line/callee đang trong cuộc gọi khác)
    socket.on('call_busy', (payload) => {
      console.log('[SOCKET] 🛑 call_busy received:', payload);
      leaveCallScreen('call_busy', payload);
    });

    // Caller nhận khi callee chủ động bấm Reject (IncomingCallModal.handleReject)
    // HOẶC khi server gửi not_following vì 2 bên chưa follow lẫn nhau.
    // BẤT KỲ reason nào → caller PHẢI thoát CallScreen.
    socket.on('call_rejected', (payload) => {
      console.log('[SOCKET] 🛑 call_rejected received:', payload);
      // Nếu server kèm reason đặc biệt (vd not_following), hiển thị message thân thiện
      if (payload?.reason === 'not_following') {
        dispatch(setCallError(payload?.message || 'Cả hai cần follow lẫn nhau để gọi.'));
        console.log('[SOCKET] 🛑 call_rejected reason=not_following → set callError');
      }
      // Luôn thoát CallScreen, bất kể reason
      leaveCallScreen('call_rejected', payload);
    });

    // Caller nhận khi mình chủ động hủy trước khi ai nhấc máy
    // (CallScreen gọi socketEmitter.emit('call_cancelled') ở handleEndCall
    // khi remoteUsers.length === 0). Trong trường hợp này chính mình đã navigate
    // goBack() rồi, nhưng để chắc chắn vẫn gọi helper.
    socket.on('call_cancelled', (payload) => {
      console.log('[SOCKET] 🛑 call_cancelled received:', payload);
      leaveCallScreen('call_cancelled', payload);
    });

    // Caller nhận khi có người khác nhấc máy (group call, target khác với mình)
    socket.on('call_answered_elsewhere', (payload) => {
      console.log('[SOCKET] 🛑 call_answered_elsewhere received:', payload);
      leaveCallScreen('call_answered_elsewhere', payload);
    });

    // === Issue 2: Lắng nghe event 'call_ended' từ server ===
    // Khi 1 bên bấm End Call, server emit call_ended tới tất cả thành viên
    // còn lại trong channel → bên còn lại tự động thoát CallScreen.
    // - Bỏ qua nếu chính mình là người rời (endedBy === currentUserId) → tránh lặp.
    // - Chỉ xử lý nếu đang thực sự ở trong channel đó (activeCallChannelRef khớp).
    socket.on('call_ended', (payload) => {
      console.log('[SOCKET] 🛑 call_ended received:', payload);
      const currentUserId = user?.id || user?._id;
      // Bỏ qua nếu chính mình là người end call (đã tự cleanup rồi)
      if (payload?.endedBy && String(payload.endedBy) === String(currentUserId)) {
        console.log('[SOCKET] call_ended ignored — I am the one who ended the call');
        return;
      }
      // Chỉ xử lý nếu đang trong channel này
      if (
        activeCallChannelRef.current &&
        String(activeCallChannelRef.current) === String(payload?.channelName)
      ) {
        console.log('[SOCKET] call_ended: leaving CallScreen because peer ended the call');
        leaveCallScreen('call_ended', payload);
      } else {
        console.log('[SOCKET] call_ended ignored — not in this channel', {
          active: activeCallChannelRef.current,
          payload: payload?.channelName,
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      socketEmitter._socket = null;
    };
  }, [token, user, dispatch]);

  return socketRef.current;
}
