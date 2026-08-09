import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import io from 'socket.io-client';
import { API_BASE_URL } from '../components/constants/api';
import { addNotification, setUnreadCount } from '../redux/notificationSlice';
import { requestNotificationPermission, showLocalNotification } from '../utils/localNotifications';
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
  setCallState,
  setEndedReason,
} from '../redux/chatSlice';
import { safeGoBackFromCall } from '../navigation/navigationRef';
import { updatePostLikes, updateCommentCount } from '../redux/postSlice';


export const socketEmitter = {
  _socket: null,
  
  emit(event, data, ackFn) {
    if (ackFn) {
      this._socket?.emit(event, data, ackFn);
    } else {
      this._socket?.emit(event, data);
    }
  },
};

let socketInstance = null;

export function getSocket() {
  return socketInstance;
}

export function useSocket() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const activeCallChannel = useSelector((state) => state.chat.activeCallChannel);
  const incomingCall = useSelector((state) => state.chat.incomingCall);
  const activeCallChannelRef = useRef(activeCallChannel);
  const incomingCallRef = useRef(incomingCall);

  useEffect(() => {
    activeCallChannelRef.current = activeCallChannel;
  }, [activeCallChannel]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    if (!token || !user) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketEmitter._socket = null;
        socketInstance = null;
      }
      return;
    }

    const userId = user.id || user._id;
    if (!userId) return;

    requestNotificationPermission();

    if (!socketInstance) {
      console.log('[SOCKET] Connecting to:', API_BASE_URL);
      socketInstance = io(API_BASE_URL, {
        transports: ['websocket'],
        auth: { token },
      });

      socketEmitter._socket = socketInstance;

      socketInstance.on('connect', () => {
        console.log('[SOCKET] Connected with socket ID:', socketInstance.id);
        socketInstance.emit('join');
        dispatch(fetchChatUnreadCount());
        requestNotificationPermission();
      });

      socketInstance.on('connect_error', (err) => {
        console.warn('[SOCKET] Connection rejected:', err.message);
      });

      socketInstance.on('new_notification', (notification) => {
        if (notification?.type === 'message') return;
        console.log('[SOCKET] Received new notification:', notification);
        dispatch(addNotification(notification));

        const authorName = notification.fromUserId?.name || 'VibeSport';
        const body = notification.message || 'Bạn có thông báo mới!';
        showLocalNotification({
          title: authorName,
          body,
          data: { notification },
        });
      });

      socketInstance.on('unread_count', ({ unreadCount }) => {
        console.log('[SOCKET] Received unread count:', unreadCount);
        dispatch(setUnreadCount(unreadCount));
      });

      socketInstance.on('new_message', (payload) => {
        dispatch(receiveMessage({ ...payload, currentUserId: userId }));
        const sender = payload?.message?.senderId;
        const senderId = typeof sender === 'object' ? sender?._id : sender;
        if (senderId && senderId !== userId) {
          const senderName = typeof sender === 'object' ? sender?.name : 'Tin nhắn mới';
          const text = payload?.message?.content || payload?.message?.text || 'Bạn có tin nhắn mới';
          showLocalNotification({
            title: senderName,
            body: text,
            data: { message: payload?.message },
          });
        }
      });

      socketInstance.on('new_pending_message', (payload) => {
        dispatch(receivePendingMessage({ ...payload, currentUserId: userId }));
      });

      socketInstance.on('unread_messages_count', ({ unreadCount }) => {
        dispatch(setChatUnreadCount(unreadCount));
      });

      socketInstance.on('conversation_accepted', (payload) => {
        dispatch(conversationAccepted({ ...payload, currentUserId: userId }));
      });

      socketInstance.on('conversation_blocked', (payload) => {
        dispatch(conversationBlocked(payload));
      });

      socketInstance.on('post_comment_updated', (payload) => {
        socketEmitter.emit('post_comment_updated', payload);
      });

      socketInstance.on('conversation_unblocked', (payload) => {
        dispatch(conversationUnblocked(payload));
      });

      socketInstance.on('pending_messages_deleted', (payload) => {
        dispatch(pendingMessagesDeletedByOther(payload));
      });

      socketInstance.on('group_updated', (payload) => {
        dispatch(groupUpdated(payload));
      });

      socketInstance.on('member_muted', (payload) => {
        dispatch(memberMuted(payload));
      });

      socketInstance.on('member_unmuted', (payload) => {
        dispatch(memberUnmuted(payload));
      });

      socketInstance.on('pinned_message', (payload) => {
        dispatch(groupUpdated(payload));
      });

      socketInstance.on('unpinned_message', (payload) => {
        dispatch(groupUpdated(payload));
      });

      socketInstance.on('join_request_approved', (payload) => {
        dispatch(joinRequestUpdated(payload));
      });

      socketInstance.on('join_request_rejected', (payload) => {
        dispatch(joinRequestUpdated(payload));
      });

      socketInstance.on('message_recalled', (payload) => {
        dispatch(messageRecalled(payload));
      });

      socketInstance.on('post_reaction_updated', (payload) => {
        console.log('[SOCKET] Post reaction updated:', payload);
        dispatch(updatePostLikes(payload));
      });

      socketInstance.on('post_comment_updated', (payload) => {
        console.log('[SOCKET] Post comment updated:', payload);
        dispatch(updateCommentCount(payload));
      });

      socketInstance.on('account_locked', (payload) => {
        Alert.alert(
          '⛔ TÀI KHOẢN ĐÃ BỊ KHÓA',
          payload?.reason || 'Tài khoản của bạn đã bị khóa do điểm đánh giá trung bình rơi xuống dưới 2.0⭐.'
        );
      });

      
      const leaveCallScreen = (reason, payload) => {
        // Clear Redux
        dispatch(clearIncomingCall());
        dispatch(clearActiveCallChannel());
        // Clear refs
        activeCallChannelRef.current = null;
        incomingCallRef.current = null;
        
        const finalReason = payload?.reason && payload.reason !== 'not_following'
          ? payload.reason
          : reason;
        dispatch(setEndedReason(finalReason));
        dispatch(setCallState('ENDED'));
        safeGoBackFromCall();
      };

      socketInstance.on('incoming_call', (payload) => {
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
        // Cập nhật ref TRƯỚC khi dispatch để chặn ngay các incoming_call kế tiếp
        // trong cùng tick (tránh bug useEffect sync ref trễ → duplicate emit call_busy)
        incomingCallRef.current = payload;
        activeCallChannelRef.current = payload.channelName;
        dispatch(setIncomingCall(payload));
        dispatch(setActiveCallChannel(payload.channelName));
        // State machine: callee bắt đầu chuông
        dispatch(setCallState('INCOMING_RINGING'));
      });

      // Caller nhận khi người kia đang bận (line/callee đang trong cuộc gọi khác)
      socketInstance.on('call_busy', (payload) => {
        leaveCallScreen('call_busy', payload);
      });

      
      socketInstance.on('call_rejected', (payload) => {
        // Case 1: not_following → đóng ngay, dùng leaveCallScreen để đảm bảo
        // đầy đủ cleanup (refs + dispatch + pop).
        if (payload?.reason === 'not_following') {
          dispatch(setCallError(payload?.message || 'Cả hai cần follow lẫn nhau để gọi.'));
          leaveCallScreen('call_rejected', payload);
          return;
        }

        // Case 2: reject/timeout → dispatch state NGAY để CallScreen overlay
        // hiển thị text theo endedReason, delay 1.8s rồi mới pop.
        dispatch(clearIncomingCall());
        dispatch(clearActiveCallChannel());
        activeCallChannelRef.current = null;
        incomingCallRef.current = null;

        const finalReason = payload?.reason || 'call_rejected';
        dispatch(setEndedReason(finalReason));
        dispatch(setCallState('ENDED'));

        // Delay 1.8s trước khi pop CallScreen — đủ để user đọc
        // "Cuộc gọi bị từ chối" / "Không có phản hồi" trên overlay.
        // safeGoBackFromCall tự check route.name nên an toàn nếu user đã navigate
        // đi chỗ khác trong lúc chờ.
        setTimeout(() => {
          safeGoBackFromCall();
        }, 1800);
      });

      // Caller nhận khi mình chủ động hủy trước khi ai nhấc máy
      // (CallScreen gọi socketEmitter.emit('call_cancelled') ở handleEndCall
      // khi remoteUsers.length === 0). Trong trường hợp này chính mình đã navigate
      // goBack() rồi, nhưng để chắc chắn vẫn gọi helper.
      socketInstance.on('call_cancelled', (payload) => {
        leaveCallScreen('call_cancelled', payload);
      });

      // Caller nhận khi có người khác nhấc máy (group call, target khác với mình)
      socketInstance.on('call_answered_elsewhere', (payload) => {
        leaveCallScreen('call_answered_elsewhere', payload);
      });

      // === Issue 2: Lắng nghe event 'call_ended' từ server ===
      // Khi 1 bên bấm End Call, server emit call_ended tới tất cả thành viên
      // còn lại trong channel → bên còn lại tự động thoát CallScreen.
      // - Bỏ qua nếu chính mình là người rời (endedBy === currentUserId) → tránh lặp.
      // - Chỉ xử lý nếu đang thực sự ở trong channel đó (activeCallChannelRef khớp).
      socketInstance.on('call_ended', (payload) => {
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
          leaveCallScreen('call_ended', payload);
        } else {
          console.log('[SOCKET] call_ended ignored — not in this channel', {
            active: activeCallChannelRef.current,
            payload: payload?.channelName,
          });
        }
      });

      socketInstance.on('disconnect', () => {
        console.log('[SOCKET] Disconnected');
      });
    }

    return () => {
      // Keep open globally
    };
  }, [token, user, dispatch]);

  return socketInstance;
}