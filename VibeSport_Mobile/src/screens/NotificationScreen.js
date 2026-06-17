import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../redux/notificationSlice';
import { API_BASE_URL } from '../components/constants/api';

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

export function NotificationScreen({ navigation }) {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const { notifications, loading, unreadCount } = useSelector((state) => state.notifications);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchNotifications());
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead());
  };

  const handleNotificationPress = (item) => {
    if (!item.read) {
      dispatch(markNotificationRead(item._id));
    }

    if (item.type === 'message') {
      const conversationId = item.conversationId?._id || item.conversationId;
      const fromUser = item.fromUserId;
      if (conversationId && fromUser) {
        navigation.navigate('ChatDetail', {
          conversationId,
          peer: {
            _id: fromUser._id,
            name: fromUser.name,
            picture: fromUser.picture,
          },
        });
        return;
      }
    }

    const postId = item.postId?._id || item.postId;
    if (postId) {
      navigation.navigate('PostDetail', { postId });
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

    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
        style={[styles.notificationItem, isUnread && styles.unreadItem]}
      >
        {/* Sender Avatar */}
        {fromUser?.picture ? (
          <Image source={{ uri: fixMediaUrl(fromUser.picture) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(senderName) }]}>
            <Text style={styles.avatarPlaceholderText}>
              {senderName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Content Info */}
        <View style={styles.contentInfo}>
          <Text style={[styles.messageText, isUnread && styles.unreadMessageText]}>
            {item.message}
          </Text>
          <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
        </View>

        {/* Post Thumbnail (if exists) */}
        {item.postThumbnail ? (
          <Image source={{ uri: fixMediaUrl(item.postThumbnail) }} style={styles.postThumbnail} />
        ) : item.postId ? (
          // Fallback if no thumbnail but has post reference
          <View style={styles.postIconPlaceholder}>
            <Ionicons name="document-text-outline" size={18} color="#9CA3AF" />
          </View>
        ) : null}

        {/* Unread indicator dot */}
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={styles.safeArea}>
      <ScreenHeader style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.markAllBtn}
          >
            <Text style={styles.markAllText}>Đọc tất cả</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRightPlaceholder} />
        )}
      </ScreenHeader>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} colors={['#FF6B35']} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>Bạn chưa có thông báo nào.</Text>
            </View>
          ) : (
            <ActivityIndicator size="large" color="#FF6B35" style={styles.loader} />
          )
        }
      />
    </Screen>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  markAllText: {
    fontSize: 13,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  headerRightPlaceholder: {
    width: 60,
  },
  listContent: {
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  unreadItem: {
    backgroundColor: '#FFF7ED', // light tint orange
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    marginRight: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 18,
  },
  unreadMessageText: {
    color: '#1F2937',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  postThumbnail: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  postIconPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B35',
    marginLeft: 8,
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
