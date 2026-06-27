import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { getPostsRequest } from '../services/postApi';
import { getUserProfileRequest, getUserTeamsRequest, toggleFollowRequest } from '../services/userApi';
import { openConversation } from '../redux/chatSlice';
import { updatePostFollowStatus } from '../redux/postSlice';
import { API_BASE_URL } from '../components/constants/api';
import { getPresenceDisplay } from '../utils/presence';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { TagIcon } from '../components/TagIcon';

const ACCENT = '#FF6B35';
const BG = '#f4f6fb';

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const sum = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

function fixMediaUrl(url) {
  if (!url) return url;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

function formatTime(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${diffDays} ngày trước`;
}

function formatMonthYear(dateString) {
  const d = new Date(dateString);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${mm}/${d.getFullYear()}`;
}

function progressWidth(value, max) {
  const safeMax = Math.max(max, value, 1);
  return `${Math.min(100, (value / safeMax) * 100)}%`;
}

const ACHIEVEMENT_ROWS = [
  { key: 'matchesPlayed', label: 'Số trận đã chơi', max: 60 },
  { key: 'matchesWon', label: 'Trận thắng', max: 40 },
  { key: 'rating', label: 'Đánh giá', max: 5, format: (v) => (v ? v.toFixed(1) : '0') },
  { key: 'mvp', label: 'MVP', max: 15 },
];

function StatBox({ value, label }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProgressRow({ label, value, displayValue, max }) {
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{displayValue ?? value}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressWidth(Number(value) || 0, max) }]} />
      </View>
    </View>
  );
}

function TeamCard({ team, past }) {
  const period = past && team.leftAt
    ? `Tham gia từ ${formatMonthYear(team.joinedAt)} - ${formatMonthYear(team.leftAt)}`
    : `Tham gia từ ${formatMonthYear(team.joinedAt)}`;

  return (
    <View style={styles.teamCard}>
      {team.logo ? (
        <Image source={{ uri: fixMediaUrl(team.logo) }} style={styles.teamLogo} />
      ) : (
        <View style={styles.teamLogoPlaceholder}>
          <MaterialCommunityIcons name="shield-half-full" size={22} color={ACCENT} />
        </View>
      )}
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{team.name}</Text>
        <Text style={styles.teamRole}>{team.role || 'Thành viên'}</Text>
        <Text style={styles.teamDate}>{period}</Text>
      </View>
    </View>
  );
}

export default function UserProfileScreen({ route, navigation }) {
  const dispatch = useDispatch();
  const { userId } = route.params;
  const token = useSelector((state) => state.auth.token);

  const [profile, setProfile] = useState(null);
  const [teams, setTeams] = useState({ active: [], past: [] });
  const [posts, setPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [presenceTick, setPresenceTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setPresenceTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadProfile = useCallback(async () => {
    const [profileRes, teamsRes] = await Promise.all([
      getUserProfileRequest(userId, token),
      getUserTeamsRequest(userId, token),
    ]);
    setProfile(profileRes.data);
    setTeams(teamsRes.data || { active: [], past: [] });
  }, [userId, token]);

  const loadPosts = useCallback(async () => {
    const res = await getPostsRequest(1, 20, token, null, userId);
    setPosts(res.data || []);
  }, [userId, token]);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadProfile(), loadPosts()]);
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không tải được trang cá nhân');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadProfile, loadPosts, navigation]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const handleFollow = async () => {
    if (!profile || profile.isSelf) return;
    setFollowLoading(true);
    try {
      const res = await toggleFollowRequest(userId, token);
      const nextFollow = Boolean(res.following);
      setProfile((prev) => ({
        ...prev,
        isFollowing: nextFollow,
        isFollowedBy: res.isFollowedBy,
        followerCount: prev.followerCount + (nextFollow ? 1 : -1),
      }));
      dispatch(updatePostFollowStatus({ userId, isFollowing: nextFollow }));
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không cập nhật được theo dõi');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    try {
      const result = await dispatch(openConversation(userId)).unwrap();
      navigation.navigate('ChatDetail', {
        conversationId: result.data._id,
        peer: result.data.peer,
      });
    } catch (err) {
      Alert.alert('Lỗi', err?.message || err || 'Không thể mở cuộc trò chuyện');
    }
  };

  const presence = useMemo(
    () => getPresenceDisplay(profile?.presence?.lastSeenAt),
    [profile?.presence?.lastSeenAt, presenceTick]
  );

  if (loading || !profile) {
    return (
      <Screen style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={ACCENT} />
      </Screen>
    );
  }

  const stats = profile.stats || {};
  const avatarColor = getAvatarColor(profile.name);

  const renderPost = ({ item }) => (
    <TouchableOpacity
      style={styles.postCard}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
    >
      <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
      {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
      {item.location ? <Text style={styles.postMeta}>{item.location}</Text> : null}
      <View style={styles.postFooter}>
        <Text style={styles.postFooterText}>{item.likesCount || 0} thích</Text>
        <Text style={styles.postFooterText}>{item.commentsCount || 0} bình luận</Text>
      </View>
    </TouchableOpacity>
  );

  const renderTabContent = () => {
    if (activeTab === 'achievements') {
      return (
        <View style={styles.tabPanel}>
          <Text style={styles.sectionTitle}>Thống kê tổng quan</Text>
          {ACHIEVEMENT_ROWS.map((row) => {
            const raw = row.key === 'rating' ? profile.rating : stats[row.key];
            const display = row.format ? row.format(raw) : raw ?? 0;
            return (
              <ProgressRow
                key={row.key}
                label={row.label}
                value={raw ?? 0}
                displayValue={display}
                max={row.max}
              />
            );
          })}
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Danh hiệu</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badgeCard}>
              <MaterialCommunityIcons name="trophy" size={28} color="#F5A623" />
              <Text style={styles.badgeValue}>{stats.mvp || 0}</Text>
              <Text style={styles.badgeLabel}>MVP</Text>
            </View>
            <View style={styles.badgeCard}>
              <MaterialCommunityIcons name="medal" size={28} color={ACCENT} />
              <Text style={styles.badgeValue}>{stats.matchesWon || 0}</Text>
              <Text style={styles.badgeLabel}>Trận thắng</Text>
            </View>
            <View style={styles.badgeCard}>
              <MaterialCommunityIcons name="star" size={28} color="#F5A623" />
              <Text style={styles.badgeValue}>{stats.matchesPlayed || 0}</Text>
              <Text style={styles.badgeLabel}>Trận đấu</Text>
            </View>
          </View>
        </View>
      );
    }

    if (activeTab === 'teams') {
      return (
        <View style={styles.tabPanel}>
          <Text style={styles.sectionTitle}>Đội đang tham gia</Text>
          {teams.active?.length ? (
            teams.active.map((team) => <TeamCard key={team.teamId} team={team} />)
          ) : (
            <Text style={styles.emptyText}>Chưa tham gia đội nào</Text>
          )}
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Đội đã tham gia</Text>
          {teams.past?.length ? (
            teams.past.map((team) => <TeamCard key={team.teamId} team={team} past />)
          ) : (
            <Text style={styles.emptyText}>Chưa có lịch sử đội</Text>
          )}
        </View>
      );
    }

    return (
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderPost}
        scrollEnabled={false}
        ListEmptyComponent={<Text style={styles.emptyText}>Chưa có bài viết</Text>}
      />
    );
  };

  return (
    <Screen style={styles.screen}>
      <ScreenHeader style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trang cá nhân</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#7C8190" />
        </TouchableOpacity>
      </ScreenHeader>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[ACCENT]} />}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            {profile.picture ? (
              <Image source={{ uri: profile.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarLetter}>{profile.name?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
            )}
            {presence.isOnline ? <View style={styles.onlineDot} /> : null}
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.userName}>{profile.name}</Text>
            <MaterialCommunityIcons name="check-decagram" size={18} color={ACCENT} />
          </View>

          <View style={styles.metaRow}>
            {profile.favoriteSport ? (
              <View style={styles.metaItem}>
                <TagIcon tagName={profile.favoriteSport} size={14} color="#7C8190" />
                <Text style={styles.metaText}>{profile.favoriteSport}</Text>
              </View>
            ) : null}
            {profile.position ? (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="account-outline" size={14} color="#7C8190" />
                <Text style={styles.metaText}>{profile.position}</Text>
              </View>
            ) : null}
            {profile.area ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={14} color="#7C8190" />
                <Text style={styles.metaText}>{profile.area}</Text>
              </View>
            ) : null}
          </View>

          {profile.bio ? (
            <Text style={styles.bioText}>{profile.bio}</Text>
          ) : null}

          <Text style={[styles.activeStatus, !presence.isOnline && styles.activeStatusOffline]}>
            {presence.label}
          </Text>

          <View style={styles.followStatsRow}>
            <TouchableOpacity
              style={styles.followStatItem}
              onPress={() =>
                navigation.navigate('FollowList', {
                  initialTab: 'following',
                  userId: profile.isSelf ? undefined : userId,
                  ownerName: profile.isSelf ? undefined : profile.name,
                })
              }
            >
              <Text style={styles.followStatValue}>{profile.followingCount ?? 0}</Text>
              <Text style={styles.followStatLabel}>Đang theo dõi</Text>
            </TouchableOpacity>
            <View style={styles.followStatDivider} />
            <TouchableOpacity
              style={styles.followStatItem}
              onPress={() =>
                navigation.navigate('FollowList', {
                  initialTab: 'followers',
                  userId: profile.isSelf ? undefined : userId,
                  ownerName: profile.isSelf ? undefined : profile.name,
                })
              }
            >
              <Text style={styles.followStatValue}>{profile.followerCount ?? 0}</Text>
              <Text style={styles.followStatLabel}>Người theo dõi</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <StatBox value={stats.matchesPlayed || 0} label="Trận đã chơi" />
            <StatBox value={stats.matchesWon || 0} label="Trận thắng" />
            <StatBox value={(profile.rating || 0).toFixed(1)} label="Đánh giá" />
          </View>

          {!profile.isSelf ? (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleMessage}>
                <Feather name="message-circle" size={18} color="#1F2937" />
                <Text style={styles.actionBtnText}>Nhắn tin</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  profile.isFollowing && styles.actionBtnFollowing,
                  profile.isFollowedBy && !profile.isFollowing && styles.actionBtnMutual,
                ]}
                onPress={handleFollow}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={ACCENT} />
                ) : (
                  <>
                    <Feather
                      name={
                        profile.isFollowing
                          ? 'user-check'
                          : profile.isFollowedBy
                          ? 'user-minus'
                          : 'user-plus'
                      }
                      size={18}
                      color={ACCENT}
                    />
                    <Text style={[styles.actionBtnText, styles.followText]}>
                      {profile.isFollowing
                        ? 'Đang theo dõi'
                        : profile.isFollowedBy
                        ? 'Follow lại'
                        : 'Follow'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('FollowList', { initialTab: 'following' })}
              >
                <Feather name="users" size={18} color="#1F2937" />
                <Text style={styles.actionBtnText}>Quản lý theo dõi</Text>
              </TouchableOpacity>
            </View>
          )}

          {profile.mutualFriends > 0 ? (
            <Text style={styles.mutualText}>{profile.mutualFriends} bạn chung</Text>
          ) : null}
        </View>

        <View style={styles.bodyCard}>
          <View style={styles.tabs}>
            {[
              { key: 'posts', label: 'Bài viết' },
              { key: 'achievements', label: 'Thành tích' },
              { key: 'teams', label: 'Đội' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {renderTabContent()}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: BG },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#101828', fontSize: 17, fontWeight: '700' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  profileCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#FFFFFF' },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarLetter: { color: '#FFFFFF', fontSize: 32, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { color: '#101828', fontSize: 20, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#68707f', fontSize: 13 },
  bioText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 20,
  },
  activeStatus: { color: '#22C55E', fontSize: 13, marginTop: 6 },
  activeStatusOffline: { color: '#9CA3AF' },
  followStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
  },
  followStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  followStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  followStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101828',
  },
  followStatLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#68707f',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { color: '#101828', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#68707f', fontSize: 11, marginTop: 4, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 16, width: '100%' },
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
  actionBtnFollowing: { backgroundColor: '#FFF0EA', borderColor: '#FFD4C2' },
  actionBtnMutual: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  actionBtnText: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  followText: { color: ACCENT },
  mutualText: { color: '#68707f', fontSize: 12, textAlign: 'center', marginTop: 12 },
  bodyCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    minHeight: 320,
    paddingBottom: 24,
    overflow: 'hidden',
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: ACCENT },
  tabLabel: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
  tabLabelActive: { color: ACCENT, fontWeight: '700' },
  tabPanel: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  sectionTitleSpaced: { marginTop: 20 },
  progressRow: { marginBottom: 14 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: '#374151', fontSize: 13 },
  progressValue: { color: '#1F2937', fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 4 },
  badgeRow: { flexDirection: 'row', gap: 10 },
  badgeCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  badgeValue: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginTop: 6 },
  badgeLabel: { fontSize: 11, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  teamLogo: { width: 48, height: 48, borderRadius: 24 },
  teamLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamInfo: { flex: 1, marginLeft: 12 },
  teamName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  teamRole: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  teamDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  postCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  postTime: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  postContent: { fontSize: 15, color: '#1F2937', lineHeight: 22 },
  postMeta: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  postFooter: { flexDirection: 'row', gap: 16, marginTop: 10 },
  postFooterText: { fontSize: 12, color: '#9CA3AF' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', padding: 24, fontSize: 14 },
});
