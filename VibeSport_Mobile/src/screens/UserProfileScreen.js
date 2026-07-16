import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { getUserProfileRequest, toggleFollowRequest } from '../services/userApi';
import { openConversation } from '../redux/chatSlice';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  ProfileHeaderCard,
  StatsCard,
  InfoCard,
} from '../components/ProfileScreenComponents';
import { styles as profileStyles } from './ProfileScreen.styles';

const ACCENT = '#FF6B35';

export function UserProfileScreen({ route, navigation }) {
  const dispatch = useDispatch();
  const { userId } = route.params;
  const token = useSelector((state) => state.auth.token);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUserProfileRequest(userId, token);
      setProfile(res.data || res);
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không tải được trang cá nhân');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation, token, userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
  }, [loadProfile]);

  const openFollowList = useCallback(
    (initialTab) => {
      const rawOwnerName = profile?.name || profile?.email?.split('@')[0] || 'Người dùng VibeSport';
      const mappedOwnerName =
        rawOwnerName === 'Long Nguyên' || rawOwnerName === 'Long Nguyễn' || rawOwnerName === 'Long'
          ? 'Longabc'
          : rawOwnerName;
      navigation.navigate('FollowList', {
        initialTab,
        userId,
        ownerName: mappedOwnerName,
      });
    },
    [navigation, profile?.email, profile?.name, userId]
  );

  const handleFollow = useCallback(async () => {
    if (!profile) return;
    setFollowLoading(true);
    try {
      const res = await toggleFollowRequest(userId, token);
      const nextFollowing = Boolean(res.following);
      setProfile((current) => ({
        ...current,
        isFollowing: nextFollowing,
        followerCount: (current?.followerCount ?? 0) + (nextFollowing ? 1 : -1),
        isFollowedBy: res.isFollowedBy,
      }));
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không cập nhật được theo dõi');
    } finally {
      setFollowLoading(false);
    }
  }, [profile, token, userId]);

  const handleMessage = useCallback(async () => {
    if (!profile) return;
    setMessageLoading(true);
    try {
      const result = await dispatch(openConversation(userId)).unwrap();
      navigation.navigate('ChatDetail', {
        conversationId: result.data._id,
        peer: result.data.peer,
      });
    } catch (error) {
      Alert.alert('Lỗi', error?.message || error || 'Không thể mở cuộc trò chuyện');
    } finally {
      setMessageLoading(false);
    }
  }, [dispatch, navigation, profile, userId]);

  const followLabel = profile?.isFollowing ? 'Đang theo dõi' : 'Theo dõi';
  const followSummary = profile?.isFollowing && profile?.isFollowedBy
    ? 'Hai chiều theo dõi'
    : profile?.isFollowing
      ? 'Bạn đang theo dõi'
      : profile?.isFollowedBy
        ? 'Đang theo dõi bạn'
        : '';

  if (loading && !profile) {
    return (
      <Screen style={profileStyles.screen}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.emptyText}>Đang tải hồ sơ...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={profileStyles.screen}>
      <ScreenHeader style={profileStyles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={profileStyles.headerTitle}>Hồ Sơ</Text>
        <View style={profileStyles.headerSide} />
      </ScreenHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={profileStyles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT} />
        }
      >
        <ProfileHeaderCard profile={profile} />

        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionBtn, profile?.isFollowing && styles.actionBtnFollowing]}
            onPress={handleFollow}
            disabled={followLoading}
          >
            <Text style={[styles.actionBtnText, profile?.isFollowing && styles.followText]}>
              {followLoading ? 'Đang xử lý...' : followLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionBtn, styles.messageBtn]}
            onPress={handleMessage}
            disabled={messageLoading}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#0b74ff" />
            <Text style={[styles.actionBtnText, { color: '#0b74ff' }]}> 
              {messageLoading ? 'Đang mở...' : 'Nhắn tin'}
            </Text>
          </TouchableOpacity>
        </View>

        {followSummary ? (
          <Text style={[styles.followSummaryText, { marginHorizontal: 16 }]}>{followSummary}</Text>
        ) : null}

        <StatsCard profile={profile} onOpenFollowList={openFollowList} />
        <InfoCard profile={profile} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    paddingTop: 16,
    fontSize: 14,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionBtnFollowing: {
    backgroundColor: '#FFF0EA',
    borderColor: '#FFD4C2',
  },
  actionBtnText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  followText: {
    color: ACCENT,
  },
  messageBtn: {
    backgroundColor: '#FFFFFF',
  },
  followSummaryText: {
    textAlign: 'center',
    marginTop: 10,
    color: '#6B7280',
    fontSize: 13,
  },
});
