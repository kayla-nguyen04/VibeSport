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
} from '../redux/chatSlice';

export function useSocket() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const socketRef = useRef(null);

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
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SOCKET] Connected with socket ID:', socket.id);
      socket.emit('join', userId);
      dispatch(fetchChatUnreadCount());
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

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user, dispatch]);

  return socketRef.current;
}
