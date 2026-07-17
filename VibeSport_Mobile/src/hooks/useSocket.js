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
    socket.on('incoming_call', (payload) => {
      console.log('[SOCKET] incoming_call received:', payload);
      const currentUserId = user?.id || user?._id;
      // Nếu đang có cuộc gọi active HOẶC có cuộc gọi đến đang chờ → từ chối ngay
      if (activeCallChannelRef.current || incomingCallRef.current) {
        console.log('[SOCKET] incoming_call BLOCKED — busy:', {
          activeCall: activeCallChannelRef.current,
          incoming: incomingCallRef.current ? payload.channelName : null,
        });
        socketEmitter.emit('call_busy', {
          callerId: payload.callerId,
          channelName: payload.channelName,
          calleeId: currentUserId,
        });
        return;
      }
      // Không hiện modal nếu chính mình là người gọi
      if (String(payload.callerId) !== String(currentUserId)) {
        console.log('[SOCKET] incoming_call dispatching setIncomingCall:', payload);
        // Đánh dấu đang có cuộc gọi đến để chặn cuộc gọi đến thứ 2
        dispatch(setIncomingCall(payload));
        dispatch(setActiveCallChannel(payload.channelName));
        activeCallChannelRef.current = payload.channelName;
      }
    });

    socket.on('call_busy', (payload) => {
      // Người gọi nhận được khi người kia đang bận → hiện thông báo + thoát CallScreen
      console.log('[SOCKET] call_busy received:', payload);
      dispatch(clearIncomingCall());
      dispatch(clearActiveCallChannel());
      activeCallChannelRef.current = null;
      safeGoBackFromCall();
    });

    socket.on('call_rejected', (payload) => {
      // Caller nhận được khi người kia từ chối → thoát CallScreen
      dispatch(clearIncomingCall());
      dispatch(clearActiveCallChannel());
      activeCallChannelRef.current = null;
      safeGoBackFromCall();
    });

    socket.on('call_cancelled', (payload) => {
      dispatch(clearIncomingCall());
      dispatch(clearActiveCallChannel());
      activeCallChannelRef.current = null;
      safeGoBackFromCall();
    });

    socket.on('call_answered_elsewhere', (payload) => {
      console.log('[SOCKET] call_answered_elsewhere received:', payload);
      dispatch(clearIncomingCall());
      dispatch(clearActiveCallChannel());
      activeCallChannelRef.current = null;
      safeGoBackFromCall();
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
