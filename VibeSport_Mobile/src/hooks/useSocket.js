import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import io from 'socket.io-client';
import { API_BASE_URL } from '../components/constants/api';
import { addNotification, setUnreadCount } from '../redux/notificationSlice';

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
    });

    socket.on('new_notification', (notification) => {
      console.log('[SOCKET] Received new notification:', notification);
      dispatch(addNotification(notification));
    });

    socket.on('unread_count', ({ unreadCount }) => {
      console.log('[SOCKET] Received unread count:', unreadCount);
      dispatch(setUnreadCount(unreadCount));
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
