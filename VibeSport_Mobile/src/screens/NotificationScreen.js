import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { ScreenHeader } from '../components/ScreenHeader';
import { BackButton } from '../components/BackButton';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../redux/notificationSlice';
import { API_BASE_URL } from '../components/constants/api';
import { useNotificationNavigationQueue } from '../hooks/useNotificationNavigationQueue';

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[charCodeSum % AVATAR_COLORS.length];
};

function fixMediaUrl(url) {
  if (!url) return url;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

function normalizeNotificationMessage(message) {
  if (typeof message !== 'string') return '';
  return message.replace(/đã Vibe bài viết của bạn/gi, 'đã thích bài viết của bạn');
}

export function NotificationScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const currentUser = useSelector((state) => state.auth.user);
  const { notifications, loading } = useSelector((state) => state.notifications);
  const conversations = useSelector((state) => state.chat.conversations);
  const { enqueue } = useNotificationNavigationQueue(navigation);
  const [refreshing, setRefreshing] = useState(false);
  const visibleNotifications = useMemo(
    () => notifications.filter((item) => item.type !== 'message'),
    [notifications]
  );

  const handleAvatarPress = (fromUser) => {
    const userId = fromUser?._id || fromUser?.id || fromUser;
    if (!userId) return;
    const myId = currentUser?._id || currentUser?.id;
    if (userId === myId) {
      navigation.navigate('Home', { screen: 'ProfileTab' });
    } else {
      navigation.navigate('UserProfile', { userId });
    }
  };

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchNotifications()).unwrap();
    } catch {
      // The slice already exposes the request error; only reset the native refresh control here.
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead());
  };

  const handleHeaderMorePress = () => {
    Alert.alert(
      'Tùy chọn thông báo',
      '',
      [
        {
          text: 'Đánh dấu đọc tất cả',
          onPress: handleMarkAllRead,
        },
        {
          text: 'Hủy',
          style: 'cancel',
        },
      ]
    );
  };

  const handleNotificationPress = (item) => {
    if (!item.read) {
      dispatch(markNotificationRead(item._id));
    }

    if (item.type === 'follow') {
      const senderId = item.fromUserId?._id || item.fromUserId;
      if (senderId) {
        navigation.navigate('UserProfile', {
          userId: senderId,
          initialProfile: typeof item.fromUserId === 'object' ? item.fromUserId : undefined,
        });
      }
      return;
    }

    if (item.type === 'post_restored' || item.type === 'violation_removed') {
      const postId = item.postId?._id || item.postId;
      if (postId) {
        navigation.navigate('PostDetail', { postId });
      }
      return;
    }

    const postId = item.postId?._id || item.postId;
    if (postId) {
      navigation.navigate('PostDetail', { postId });
      return;
    }

    const matchId = item.matchId?._id || item.matchId;
    if (item.type === 'match' && matchId) {
      navigation.navigate('MatchDetail', { matchId });
      return;
    }

    const conversationId = item.conversationId?._id || item.conversationId;
    if (item.type === 'group' && conversationId) {
      const found = conversations.find((c) => String(c._id) === String(conversationId));
      if (found) {
        navigation.navigate('GroupManagement', { conversationId });
      } else {
        enqueue(conversationId, 'group');
      }
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  };

  const renderItem = ({ item }) => {
    const fromUser = item.fromUserId;
    const senderName = fromUser?.name || 'Thành viên VibeSport';
    const isUnread = !item.read;
    const firstLetter = senderName.charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
        style={[
          styles.notificationItem,
          isUnread ? styles.unreadItem : styles.readItem
        ]}
      >
        <TouchableOpacity
          onPress={() => handleAvatarPress(fromUser)}
          activeOpacity={0.8}
        >
          {item.type === 'violation_removed' ? (
            <View style={[styles.avatarPlaceholder, { backgroundColor: '#DC2626' }]}>
              <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
            </View>
          ) : item.type === 'post_restored' ? (
            <View style={[styles.avatarPlaceholder, { backgroundColor: '#059669' }]}>
              <Ionicons name="refresh" size={22} color="#FFFFFF" />
            </View>
          ) : fromUser?.picture ? (
            <Image source={{ uri: fixMediaUrl(fromUser.picture) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(senderName) }]}>
              <Text style={styles.avatarPlaceholderText}>{firstLetter}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.contentInfo}>
          <Text style={[styles.messageText, isUnread && styles.unreadMessageText]}>
            {normalizeNotificationMessage(item.message)}
          </Text>
          <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
        </View>

        {isUnread && (
          <View style={styles.redDot} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.safeArea,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <ScreenHeader style={styles.header}>
        <View style={styles.headerSide}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>

        <Text style={styles.headerTitle}>
          Thông <Text style={styles.headerTitleHighlight}>Báo</Text>
        </Text>

        <View style={[styles.headerSide, styles.headerSideRight]}>
          <TouchableOpacity
            onPress={handleHeaderMorePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerIconButton}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
      </ScreenHeader>

      <FlatList
        data={visibleNotifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#FF6B35']}
            tintColor="#FF6B35"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading && visibleNotifications.length === 0 ? (
            <ActivityIndicator size="large" color="#FF6B35" style={styles.loader} />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>Bạn chưa có thông báo nào.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerSide: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSideRight: {
    marginLeft: 'auto',
  },
  headerTitle: {
    position: 'absolute',
    left: 60,
    right: 60,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerTitleHighlight: {
    color: '#FF5F3D',
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 16,
    marginBottom: 12,
    position: 'relative',
  },
  unreadItem: {
    borderColor: '#E5E7EB',
  },
  readItem: {
    borderColor: '#E5E7EB',
    opacity: 0.45,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  messageText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 18,
  },
  unreadMessageText: {
    color: '#000000',
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  redDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 120,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 15,
    marginTop: 16,
  },
  loader: {
    marginTop: 60,
  },
});
