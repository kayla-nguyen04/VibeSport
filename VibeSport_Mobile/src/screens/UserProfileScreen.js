import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { BackButton } from '../components/BackButton';
import { API_BASE_URL } from '../components/constants/api';
import {
  HeaderIconButton,
  ProfileHeaderCard,
  ProfilePostCard,
  ProfileTabBar,
} from '../components/ProfileScreenComponents';
import { ReportModal } from '../components/ReportModal';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { openConversation } from '../redux/chatSlice';
import {
  fetchSavedPosts,
  likePost,
  savePost,
  unlikePost,
  unsavePost,
} from '../redux/postSlice';
import { getMatches } from '../services/matchService';
import { getPostsRequest, reportPostRequest } from '../services/postApi';
import {
  getUserProfileRequest,
  reportUserRequest,
  toggleFollowRequest,
} from '../services/userApi';
import { icon, primary } from '../theme';
import { styles as profileStyles } from './ProfileScreen.styles';

const ACCENT = '#FF6B35';
const profileCache = new Map();
const profilePostsCache = new Map();
const profileHistoryCache = new Map();

function getUserId(user) {
  if (!user) return null;
  return user._id || user.id || user.userId || user.user?._id || user.user?.id;
}

function getPostId(post) {
  return post?._id || post?.id;
}

function getPostAuthorId(post) {
  const author = post?.userId || post?.createdBy || post?.author || post?.user;
  return typeof author === 'object' && author !== null
    ? getUserId(author)
    : author;
}

function fixMediaUrl(url) {
  if (!url) return url;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

function getStatusConfig(status) {
  switch (status) {
    case 'completed':
      return { label: 'Đã hoàn thành', color: '#10B981' };
    case 'cancelled':
      return { label: 'Đã hủy', color: '#EF4444' };
    case 'full':
      return { label: 'Đang diễn ra', color: '#0B74FF' };
    default:
      return { label: 'Sắp diễn ra', color: '#F5A623' };
  }
}

export function UserProfileScreen({ route, navigation }) {
  const dispatch = useDispatch();
  const { userId, initialProfile } = route.params || {};
  const token = useSelector((state) => state.auth.token);
  const currentUser = useSelector((state) => state.auth.user);
  const feedPosts = useSelector((state) => state.posts?.posts || []);
  const savedPosts = useSelector((state) => state.posts?.savedPosts || []);
  const currentUserId = getUserId(currentUser);
  const cacheKey = `${String(currentUserId || '')}:${String(userId || '')}`;

  const cachedProfile = useMemo(() => {
    const cached = profileCache.get(cacheKey);
    if (cached) return cached;
    const cachedPost = [...feedPosts, ...savedPosts].find(
      (post) => String(getPostAuthorId(post) || '') === String(userId || '')
    );
    const author = cachedPost?.userId;
    return author && typeof author === 'object' ? author : null;
  }, [cacheKey, feedPosts, savedPosts, userId]);

  const cachedPosts = useMemo(() => {
    const cached = profilePostsCache.get(cacheKey);
    if (cached) return cached;
    return feedPosts.filter(
      (post) => String(getPostAuthorId(post) || '') === String(userId || '')
    );
  }, [cacheKey, feedPosts, userId]);

  const cachedHistory = profileHistoryCache.get(cacheKey) || [];

  const [profile, setProfile] = useState(
    () => ({
      ...(cachedProfile || {}),
      ...(initialProfile || {}),
      _id: userId,
      name: initialProfile?.name || cachedProfile?.name || 'Thành viên VibeSport',
    })
  );
  const [posts, setPosts] = useState(cachedPosts);
  const [postsLoading, setPostsLoading] = useState(cachedPosts.length === 0);
  const [historyMatches, setHistoryMatches] = useState(cachedHistory);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [isOptionsSheetVisible, setIsOptionsSheetVisible] = useState(false);
  const [isReportSheetVisible, setIsReportSheetVisible] = useState(false);
  const [optionsPost, setOptionsPost] = useState(null);
  const [postToReport, setPostToReport] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const mergedPosts = useMemo(() => {
    const livePostsById = new Map(
      [...feedPosts, ...savedPosts].map((post) => [getPostId(post), post])
    );
    return posts.map((post) => {
      const livePost = livePostsById.get(getPostId(post));
      return livePost ? { ...post, ...livePost } : post;
    });
  }, [feedPosts, posts, savedPosts]);

  const patchPost = useCallback((postId, updater) => {
    setPosts((current) => current.map((post) => {
      if (getPostId(post) !== postId) return post;
      return typeof updater === 'function' ? updater(post) : { ...post, ...updater };
    }));
  }, []);

  useEffect(() => {
    if (cacheKey && profile) profileCache.set(cacheKey, profile);
  }, [cacheKey, profile]);

  useEffect(() => {
    if (cacheKey) profilePostsCache.set(cacheKey, posts);
  }, [cacheKey, posts]);

  useEffect(() => {
    if (cacheKey) profileHistoryCache.set(cacheKey, historyMatches);
  }, [cacheKey, historyMatches]);

  const loadProfile = useCallback(async ({ showError = false } = {}) => {
    if (!userId || !token) return;
    try {
      const response = await getUserProfileRequest(userId, token);
      const nextProfile = response?.data || response?.user || response;
      if (nextProfile) setProfile(nextProfile);
    } catch (error) {
      if (showError) {
        Alert.alert('Lỗi', error?.message || 'Không tải được trang cá nhân.');
      }
    }
  }, [token, userId]);

  const loadPosts = useCallback(async () => {
    if (!userId || !token) return;
    try {
      const response = await getPostsRequest(1, 50, token, null, userId);
      const nextPosts = response?.data || response?.posts || [];
      setPosts(Array.isArray(nextPosts) ? nextPosts : []);
    } catch (error) {
      console.warn('[UserProfileScreen] Load posts error:', error);
    } finally {
      setPostsLoading(false);
    }
  }, [token, userId]);

  const loadHistory = useCallback(async () => {
    if (!userId || !token) return;
    setHistoryLoading(true);
    try {
      const response = await getMatches(
        { userId, participantId: userId, limit: 30, page: 1 },
        token
      );
      const nextMatches = Array.isArray(response)
        ? response
        : response?.data || response?.matches || [];
      setHistoryMatches(Array.isArray(nextMatches) ? nextMatches : []);
    } catch (error) {
      console.warn('[UserProfileScreen] Load history error:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    loadProfile();
    loadPosts();
  }, [loadPosts, loadProfile]);

  useEffect(() => {
    if (activeTab === 'history' && historyMatches.length === 0) {
      loadHistory();
    }
  }, [activeTab, historyMatches.length, loadHistory]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadProfile({ showError: true }),
      loadPosts(),
      activeTab === 'history' ? loadHistory() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [activeTab, loadHistory, loadPosts, loadProfile]);

  const openFollowList = useCallback((initialTab) => {
    navigation.navigate('FollowList', {
      initialTab,
      userId,
      ownerName: profile?.name,
    });
  }, [navigation, profile?.name, userId]);

  const handleFollow = useCallback(async () => {
    if (!profile || followLoading) return;

    const previousFollowing = Boolean(profile.isFollowing);
    const nextFollowing = !previousFollowing;
    const previousFollowerCount = profile.followerCount ?? 0;

    setFollowLoading(true);
    setProfile((current) => ({
      ...current,
      isFollowing: nextFollowing,
      followerCount: Math.max(0, previousFollowerCount + (nextFollowing ? 1 : -1)),
    }));

    try {
      const response = await toggleFollowRequest(userId, token);
      setProfile((current) => ({
        ...current,
        isFollowing: Boolean(response.following),
        isFollowedBy: response.isFollowedBy ?? current.isFollowedBy,
      }));
    } catch (error) {
      setProfile((current) => ({
        ...current,
        isFollowing: previousFollowing,
        followerCount: previousFollowerCount,
      }));
      Alert.alert('Lỗi', error?.message || 'Không cập nhật được theo dõi.');
    } finally {
      setFollowLoading(false);
    }
  }, [followLoading, profile, token, userId]);

  const handleMessage = useCallback(async () => {
    if (!profile || messageLoading) return;
    setMessageLoading(true);
    try {
      const result = await dispatch(openConversation(userId)).unwrap();
      navigation.navigate('ChatDetail', {
        conversationId: result.data._id,
        peer: result.data.peer,
      });
    } catch (error) {
      Alert.alert('Lỗi', error?.message || error || 'Không thể mở cuộc trò chuyện.');
    } finally {
      setMessageLoading(false);
    }
  }, [dispatch, messageLoading, navigation, profile, userId]);

  const handleOpenPost = useCallback((post) => {
    navigation.navigate('PostDetail', { postId: getPostId(post), post });
  }, [navigation]);

  const handleToggleLike = useCallback(async (post) => {
    const postId = getPostId(post);
    if (!postId) return;

    const snapshot = post;
    patchPost(postId, (current) => ({
      ...current,
      isLiked: !post.isLiked,
      reactionType: post.isLiked ? null : 'vibe',
      likesCount: Math.max(0, (current.likesCount || 0) + (post.isLiked ? -1 : 1)),
    }));

    try {
      const response = post.isLiked
        ? await dispatch(unlikePost(postId)).unwrap()
        : await dispatch(likePost({ postId, reactionType: 'vibe' })).unwrap();
      patchPost(postId, {
        isLiked: response.isLiked,
        reactionType: response.reactionType,
        likesCount: response.likesCount,
        topReactions: response.topReactions,
      });
    } catch (error) {
      patchPost(postId, snapshot);
      Alert.alert('Lỗi', error?.error || 'Không thể cập nhật cảm xúc.');
    }
  }, [dispatch, patchPost]);

  const handleToggleSave = useCallback((post) => {
    const postId = getPostId(post);
    const isSaved = Boolean(
      post.isSaved || savedPosts.some((item) => getPostId(item) === postId)
    );
    patchPost(postId, { isSaved: !isSaved });

    dispatch(isSaved ? unsavePost(postId) : savePost(postId))
      .unwrap()
      .then(() => dispatch(fetchSavedPosts()))
      .catch((error) => {
        patchPost(postId, { isSaved });
        Alert.alert('Lỗi', error?.error || 'Không thể cập nhật bài viết đã lưu.');
      });
  }, [dispatch, patchPost, savedPosts]);

  const handleShare = useCallback(async (post) => {
    try {
      const authorName = post.userId?.name || profile?.name || 'Thành viên VibeSport';
      const content = post.content?.trim() || '';
      const mediaLine = post.mediaUrls?.length
        ? `\n\nXem ảnh: ${fixMediaUrl(post.mediaUrls[0])}`
        : '';
      await Share.share({
        title: 'VibeSport',
        message: content
          ? `${authorName} chia sẻ trên VibeSport: "${content}"${mediaLine}`
          : `${authorName} đã chia sẻ một bài viết trên VibeSport.${mediaLine}`,
      });
    } catch (error) {
      if (error?.message !== 'User did not share') {
        console.warn('[UserProfileScreen] Share error:', error);
      }
    }
  }, [profile?.name]);

  const handleReportPost = useCallback(async (reason) => {
    if (!postToReport || !token) return;
    try {
      setReportModalVisible(false);
      await reportPostRequest(getPostId(postToReport), reason, token);
      setPostToReport(null);
      Alert.alert('Thành công', 'Cảm ơn bạn đã gửi báo cáo.');
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không thể gửi báo cáo bài viết.');
    }
  }, [postToReport, token]);

  const handleReportUser = useCallback(async (reason) => {
    setIsReportSheetVisible(false);
    try {
      await reportUserRequest(userId, reason, token);
      Alert.alert('Báo cáo thành công', 'Cảm ơn bạn đã gửi báo cáo.');
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không thể gửi báo cáo.');
    }
  }, [token, userId]);

  const followLabel = profile?.isFollowing
    ? 'Đang theo dõi'
    : profile?.isFollowedBy
      ? 'Theo dõi lại'
      : 'Theo dõi';

  return (
    <Screen edges={['top', 'left', 'right']} style={profileStyles.screen}>
      <ScreenHeader style={profileStyles.headerBar}>
        <View style={profileStyles.headerSide}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <Text style={profileStyles.headerTitle}>Hồ sơ</Text>
        <View style={[profileStyles.headerSide, profileStyles.headerRightSide]}>
          <HeaderIconButton onPress={() => setIsOptionsSheetVisible(true)}>
            <Ionicons name="ellipsis-horizontal" size={24} color={icon.dark} />
          </HeaderIconButton>
        </View>
      </ScreenHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={profileStyles.listContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
          />
        }
      >
        <View style={profileStyles.profileInfoCardBox}>
          <ProfileHeaderCard
            profile={profile}
            isSelf={false}
            onOpenFollowList={openFollowList}
          />

          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.actionButton, profile?.isFollowing && styles.followingButton]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  profile?.isFollowing && styles.followingButtonText,
                ]}
              >
                {followLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.actionButton, styles.messageButton]}
              onPress={handleMessage}
              disabled={messageLoading}
            >
              {messageLoading ? (
                <ActivityIndicator size="small" color="#0B74FF" />
              ) : (
                <>
                  <Ionicons name="chatbubble-outline" size={18} color="#0B74FF" />
                  <Text style={[styles.actionButtonText, styles.messageButtonText]}>
                    Nhắn tin
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={profileStyles.stickyTabBarWrap}>
          <ProfileTabBar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            includeSaved={false}
          />
        </View>

        <View style={profileStyles.tabContentCardBox}>
          {activeTab === 'posts' ? (
            postsLoading && mergedPosts.length === 0 ? (
              <ActivityIndicator size="small" color={primary.DEFAULT} style={styles.tabLoading} />
            ) : mergedPosts.length > 0 ? (
              mergedPosts.map((post) => (
                <ProfilePostCard
                  key={getPostId(post)}
                  post={post}
                  profile={profile}
                  onOpenPost={handleOpenPost}
                  onOpenAuthor={() => {}}
                  onToggleLike={handleToggleLike}
                  onShare={handleShare}
                  onOpenMenu={setOptionsPost}
                />
              ))
            ) : (
              <EmptyTab
                iconName="newspaper-outline"
                title="Chưa có bài viết nào"
                subtitle="Các bài viết của người này sẽ xuất hiện ở đây."
              />
            )
          ) : historyLoading ? (
            <ActivityIndicator size="small" color={primary.DEFAULT} style={styles.tabLoading} />
          ) : historyMatches.length > 0 ? (
            historyMatches.map((match) => {
              const statusConfig = getStatusConfig(match.status);
              return (
                <TouchableOpacity
                  key={match._id || match.id}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('MatchDetail', {
                    matchId: match._id || match.id,
                  })}
                  style={profileStyles.inlineMatchCard}
                >
                  <View style={profileStyles.inlineMatchTopRow}>
                    <Text style={profileStyles.inlineMatchTitle} numberOfLines={1}>
                      {match.title || match.sport || 'Trận đấu'}
                    </Text>
                    <View
                      style={[
                        profileStyles.statusBadge,
                        { backgroundColor: `${statusConfig.color}15` },
                      ]}
                    >
                      <Text
                        style={[
                          profileStyles.statusText,
                          { color: statusConfig.color },
                        ]}
                      >
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={profileStyles.inlineMatchSub} numberOfLines={1}>
                    {match.locationName || 'Sân thi đấu'}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <EmptyTab
              iconName="time-outline"
              title="Chưa có lịch sử trận đấu"
              subtitle="Các trận đấu đã tham gia hoặc tạo sẽ xuất hiện ở đây."
            />
          )}
        </View>
      </ScrollView>

      <OptionsSheet
        visible={isOptionsSheetVisible}
        onClose={() => setIsOptionsSheetVisible(false)}
        onReport={() => {
          setIsOptionsSheetVisible(false);
          setIsReportSheetVisible(true);
        }}
      />

      <ReportSheet
        visible={isReportSheetVisible}
        onClose={() => setIsReportSheetVisible(false)}
        onBack={() => {
          setIsReportSheetVisible(false);
          setIsOptionsSheetVisible(true);
        }}
        onSelectReason={handleReportUser}
      />

      <Modal
        animationType="slide"
        transparent
        visible={optionsPost !== null}
        onRequestClose={() => setOptionsPost(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setOptionsPost(null)}
          style={profileStyles.sheetOverlay}
        >
          <View style={profileStyles.sheetContainer}>
            <View style={profileStyles.sheetHandle} />
            <Text style={profileStyles.sheetTitle}>Tùy chọn bài viết</Text>

            {optionsPost ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    const post = optionsPost;
                    setOptionsPost(null);
                    handleToggleSave(post);
                  }}
                  style={profileStyles.sheetOption}
                >
                  <Ionicons
                    name={optionsPost.isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={icon.dark}
                    style={styles.sheetIcon}
                  />
                  <Text style={profileStyles.sheetOptionText}>
                    {optionsPost.isSaved
                      || savedPosts.some((item) => getPostId(item) === getPostId(optionsPost))
                      ? 'Bỏ lưu bài viết'
                      : 'Lưu bài viết'}
                  </Text>
                </TouchableOpacity>
                <View style={profileStyles.sheetDivider} />

                <TouchableOpacity
                  onPress={() => {
                    const post = optionsPost;
                    setOptionsPost(null);
                    setPostToReport(post);
                    setReportModalVisible(true);
                  }}
                  style={profileStyles.sheetOption}
                >
                  <Ionicons
                    name="flag-outline"
                    size={20}
                    color="#EF4444"
                    style={styles.sheetIcon}
                  />
                  <Text
                    style={[
                      profileStyles.sheetOptionText,
                      profileStyles.sheetOptionTextDanger,
                    ]}
                  >
                    Báo cáo bài viết
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => {
          setReportModalVisible(false);
          setPostToReport(null);
        }}
        onSelectReason={handleReportPost}
      />
    </Screen>
  );
}

function EmptyTab({ iconName, title, subtitle }) {
  return (
    <View style={profileStyles.emptyTabBox}>
      <Ionicons name={iconName} size={48} color="#D1D5DB" />
      <Text style={profileStyles.emptyTabTitle}>{title}</Text>
      <Text style={profileStyles.emptyTabSub}>{subtitle}</Text>
    </View>
  );
}

function OptionsSheet({ visible, onClose, onReport }) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={profileStyles.sheetOverlay}>
        <View style={profileStyles.sheetContainer}>
          <View style={profileStyles.sheetHandle} />
          <Text style={profileStyles.sheetTitle}>Tùy chọn</Text>
          <TouchableOpacity activeOpacity={0.78} onPress={onReport} style={profileStyles.sheetOption}>
            <Ionicons name="flag-outline" size={20} color={ACCENT} style={styles.sheetIcon} />
            <Text style={[profileStyles.sheetOptionText, { color: ACCENT }]}>
              Báo cáo trang cá nhân
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const REPORT_REASONS = [
  'Giả mạo người khác',
  'Quấy rối hoặc bắt nạt',
  'Nội dung không phù hợp',
  'Thông tin sai sự thật hoặc lừa đảo',
  'Spam',
  'Lý do khác',
];

function ReportSheet({ visible, onClose, onSelectReason, onBack }) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={profileStyles.sheetOverlay}>
        <View style={[profileStyles.sheetContainer, styles.reportSheet]}>
          <View style={profileStyles.sheetHandle} />
          <View style={styles.reportHeader}>
            <TouchableOpacity onPress={onBack} style={styles.reportBackButton}>
              <Ionicons name="chevron-back" size={24} color={ACCENT} />
            </TouchableOpacity>
            <Text style={styles.reportTitle}>Báo cáo</Text>
            <View style={styles.reportHeaderSpacer} />
          </View>

          <Text style={styles.reportQuestion}>
            Tại sao bạn báo cáo trang cá nhân này?
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                activeOpacity={0.7}
                onPress={() => onSelectReason(reason)}
                style={styles.reportReason}
              >
                <Text style={styles.reportReasonText}>{reason}</Text>
                <Ionicons name="chevron-forward" size={18} color={ACCENT} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCFBD',
    backgroundColor: '#FFF4EF',
  },
  followingButton: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  actionButtonText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  followingButtonText: {
    color: '#374151',
  },
  messageButton: {
    borderColor: '#DBEAFE',
    backgroundColor: '#FFFFFF',
  },
  messageButtonText: {
    color: '#0B74FF',
  },
  tabLoading: {
    marginVertical: 28,
  },
  sheetIcon: {
    marginRight: 12,
  },
  reportSheet: {
    maxHeight: '80%',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  reportBackButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitle: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '800',
  },
  reportHeaderSpacer: {
    width: 36,
  },
  reportQuestion: {
    marginTop: 16,
    marginBottom: 8,
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  reportReason: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  reportReasonText: {
    flex: 1,
    paddingRight: 12,
    color: '#1F2937',
    fontSize: 14,
  },
});
