import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchConversations } from '../redux/chatSlice';

export function useNotificationNavigationQueue(navigation) {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isHydrating = useSelector((state) => state.auth.isHydrating);
  const conversations = useSelector((state) => state.chat.conversations);
  const loadingConversations = useSelector((state) => state.chat.loadingConversations);

  const queueRef = useRef([]);
  const processedRef = useRef(new Set());

 const enqueue = (conversationId, type = 'chat') => {
    const id = String(conversationId);
    const key = `${type}:${id}`;
    if (!id || processedRef.current.has(key)) return;
    processedRef.current.add(key);
    queueRef.current.push({ conversationId: id, type });
  };

  const tryDrain = () => {
    if (!isAuthenticated || isHydrating) return;
    if (queueRef.current.length === 0) return;

    const remaining = [];
    for (const item of queueRef.current) {
      const conversation = conversations.find(
        (c) => String(c._id) === String(item.conversationId)
      );
      if (conversation) {
        if (item.type === 'group') {
          navigation.navigate('GroupManagement', {
            conversationId: item.conversationId,
          });
        } else {
          const peer = conversation.peer || {};
          navigation.navigate('ChatDetail', {
            conversationId: item.conversationId,
            peer: {
              _id: peer._id,
              name: peer.name || 'Nhóm',
              picture: peer.picture,
            },
          });
        }
      } else if (!loadingConversations) {
        remaining.push(item);
      }
    }

    queueRef.current = remaining;
  };
        
  useEffect(() => {
    tryDrain();
  }, [isAuthenticated, isHydrating, conversations, loadingConversations, navigation]);

  useEffect(() => {
    if (!isAuthenticated || isHydrating) return;
    const needsFetch = queueRef.current.some(
      (item) => !conversations.some((c) => String(c._id) === String(item.conversationId))
    );
    if (needsFetch && !loadingConversations) {
      dispatch(fetchConversations());
    }
  }, [isAuthenticated, isHydrating, conversations, loadingConversations, dispatch]);

  return { enqueue };
}
