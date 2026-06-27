import React, { useCallback, useState } from 'react';
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
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  getFollowersListRequest,
  getFollowingListRequest,
  toggleFollowRequest,
} from '../services/userApi';
import { updatePostFollowStatus } from '../redux/postSlice';
import { API_BASE_URL } from '../components/constants/api';

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];
const TABS = [
  { key: 'following', label: 'Đang theo dõi' },
  { key: 'followers', label: 'Người theo dõi' },
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

function fixMediaUrl(url) {
  if (!url) return url;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

export default function FollowListScreen({ route, navigation }) {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const currentUser = useSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id || currentUser?._id;

  const targetUserId = route.params?.userId || currentUserId;
  const isSelf = String(targetUserId) === String(currentUserId);
  const ownerName = route.params?.ownerName;

  const [activeTab, setActiveTab] = useState(route.params?.initialTab || 'following');
  const [followingList, setFollowingList] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionUserId, setActionUserId] = useState(null);

  const loadLists = useCallback(async (silent = false) => {
    if (!token || !targetUserId) return;

    if (!silent) setLoading(true);
    try {
      const [followingRes, followersRes] = await Promise.all([
        getFollowingListRequest(token, isSelf ? null : targetUserId),
        getFollowersListRequest(token, isSelf ? null : targetUserId),
      ]);
      setFollowingList(followingRes.data || []);
      setFollowersList(followersRes.data || []);
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tải danh sách theo dõi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, targetUserId, isSelf]);

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [loadLists])
  );

  const updateUserInLists = (userId, updates) => {
    const apply = (list) =>
      list.map((item) => (String(item._id || item.id) === String(userId) ? { ...item, ...updates } : item));

    setFollowingList((prev) => apply(prev));
    setFollowersList((prev) => apply(prev));
  };

  const handleToggleFollow = async (item) => {
    const userId = item._id || item.id;
    if (!userId || String(userId) === String(currentUserId)) return;

    setActionUserId(userId);
    try {
      const res = await toggleFollowRequest(userId, token);
      const nextFollowing = Boolean(res.following);

      updateUserInLists(userId, {
        isFollowing: nextFollowing,
        isFollowedBy: res.isFollowedBy ?? item.isFollowedBy,
      });

      if (!nextFollowing && isSelf && activeTab === 'following') {
        setFollowingList((prev) => prev.filter((user) => String(user._id || user.id) !== String(userId)));
      }

      dispatch(updatePostFollowStatus({ userId, isFollowing: nextFollowing }));
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể cập nhật theo dõi');
    } finally {
      setActionUserId(null);
    }
  };

  const currentList = activeTab === 'following' ? followingList : followersList;
  const screenTitle = isSelf
    ? 'Quản lý theo dõi'
    : ownerName
      ? `${ownerName}`
      : 'Danh sách theo dõi';

  const renderItem = ({ item }) => {
    const userId = item._id || item.id;
    const name = item.name || 'Thành viên VibeSport';
    const isMe = String(userId) === String(currentUserId);
    const isMutual = item.isFollowing && item.isFollowedBy;

    return (
      <TouchableOpacity
        style={styles.userRow}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('UserProfile', { userId })}
      >
        {item.picture ? (
          <Image source={{ uri: fixMediaUrl(item.picture) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: getAvatarColor(name) }]}>
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{name}</Text>
          <Text style={styles.userMeta} numberOfLines={1}>
            {[item.favoriteSport, item.position, item.area].filter(Boolean).join(' • ') || 'Thành viên VibeSport'}
          </Text>
          {isMutual ? <Text style={styles.mutualLabel}>Bạn bè</Text> : null}
        </View>

        {!isMe ? (
          <TouchableOpacity
            style={[
              styles.followBtn,
              item.isFollowing && styles.followBtnActive,
            ]}
            onPress={() => handleToggleFollow(item)}
            disabled={actionUserId === userId}
          >
            {actionUserId === userId ? (
              <ActivityIndicator size="small" color={item.isFollowing ? '#64748B' : '#FFFFFF'} />
            ) : (
              <Text style={[styles.followBtnText, item.isFollowing && styles.followBtnTextActive]}>
                {item.isFollowing ? 'Đang theo dõi' : item.isFollowedBy ? 'Follow lại' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={styles.screen}>
      <ScreenHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{screenTitle}</Text>
          {!isSelf && ownerName ? (
            <Text style={styles.headerSubtitle}>Danh sách theo dõi</Text>
          ) : null}
        </View>
        <View style={styles.headerSpacer} />
      </ScreenHeader>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const count = tab.key === 'following' ? followingList.length : followersList.length;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0b74ff" />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => String(item._id || item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadLists(true);
              }}
              tintColor="#0b74ff"
            />
          }
          contentContainerStyle={currentList.length === 0 ? styles.emptyList : styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Feather name="users" size={42} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {activeTab === 'following' ? 'Chưa theo dõi ai' : 'Chưa có người theo dõi'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'following'
                  ? 'Khám phá cộng đồng và follow những người bạn quan tâm.'
                  : 'Chia sẻ trang cá nhân để thu hút thêm người theo dõi.'}
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  headerSpacer: {
    width: 36,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: '#EFF6FF',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#0b74ff',
  },
  listContent: {
    paddingBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E7EB',
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  userMeta: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748B',
  },
  mutualLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#0b74ff',
  },
  followBtn: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#0b74ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  followBtnTextActive: {
    color: '#64748B',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
