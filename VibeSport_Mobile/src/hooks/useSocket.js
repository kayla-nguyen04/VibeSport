import { useEffect } from 'react';
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
import { updatePostLikes, updateCommentCount } from '../redux/postSlice';

let socketInstance = null;

export function getSocket() {
  return socketInstance;
}

export function useSocket() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);

  useEffect(() => {
    if (!token || !user) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
      return;
    }

    const userId = user.id || user._id;
    if (!userId) return;

    if (!socketInstance) {
      console.log('[SOCKET] Connecting to:', API_BASE_URL);
      socketInstance = io(API_BASE_URL, {
        transports: ['websocket'],
      });

      socketInstance.on('connect', () => {
        console.log('[SOCKET] Connected with socket ID:', socketInstance.id);
        socketInstance.emit('join', userId);
        dispatch(fetchChatUnreadCount());
      });

      socketInstance.on('new_notification', (notification) => {
        if (notification?.type === 'message') return;
        console.log('[SOCKET] Received new notification:', notification);
        dispatch(addNotification(notification));
      });

      socketInstance.on('unread_count', ({ unreadCount }) => {
        console.log('[SOCKET] Received unread count:', unreadCount);
        dispatch(setUnreadCount(unreadCount));
      });

      socketInstance.on('new_message', (payload) => {
        dispatch(receiveMessage({ ...payload, currentUserId: userId }));
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
