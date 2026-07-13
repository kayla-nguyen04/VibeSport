import React, { useEffect } from 'react';
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
import { useDispatch, useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
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

export function NotificationScreen({ navigation }) {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const currentUser = useSelector((state) => state.auth.user);
  const { notifications, loading, unreadCount } = useSelector((state) => state.notifications);
  const conversations = useSelector((state) => state.chat.conversations);
  const { enqueue } = useNotificationNavigationQueue(navigation);
  const visibleNotifications = notifications.filter((item) => item.type !== 'message');

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

  const handleRefresh = () => {
    dispatch(fetchNotifications());
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
        navigation.navigate('UserProfile', { userId: senderId });
      }
      return;
    }

    const postId = item.postId?._id || item.postId;
    if (postId) {
      navigation.navigate('PostDetail', { postId });
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
          {fromUser?.picture ? (
            <Image source={{ uri: fixMediaUrl(fromUser.picture) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(senderName) }]}>
              <Text style={styles.avatarPlaceholderText}>{firstLetter}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.contentInfo}>
          <Text style={[styles.messageText, isUnread && styles.unreadMessageText]}>
            {item.message}
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
    <Screen style={styles.safeArea}>
      <ScreenHeader style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitleNormal}>Thông </Text>
          <Text style={styles.headerTitleHighlight}>Báo</Text>
        </View>

        <TouchableOpacity
          onPress={handleHeaderMorePress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.moreHeaderBtn}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#000000" />
        </TouchableOpacity>
      </ScreenHeader>

      <FlatList
        data={visibleNotifications}
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleNormal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerTitleHighlight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5F3D',
  },
  moreHeaderBtn: {
    padding: 4,
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
