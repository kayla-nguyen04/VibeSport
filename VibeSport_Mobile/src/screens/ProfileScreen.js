import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { ReportModal } from '../components/ReportModal';
import { RatingsListModal } from '../components/RatingsListModal';
import { fetchUnreadCount } from '../redux/notificationSlice';
import { getUserProfileRequest } from '../services/userApi';
import { deletePost, fetchPosts, fetchSavedPosts, likePost, savePost, unlikePost, unsavePost } from '../redux/postSlice';
import { getPostsRequest, reportPostRequest } from '../services/postApi';
import { getMatches } from '../services/matchService';
import { API_BASE_URL } from '../components/constants/api';
import { background, icon, primary, spacing } from '../theme';
import {
  EditProfileModal,
  HeaderIconButton,
  ProfileHeaderCard,
  ProfileOptionsSheet,
  ProfilePostCard,
  ProfileTabBar,
} from '../components/ProfileScreenComponents';
import { styles } from './ProfileScreen.styles';

function fixMediaUrl(url) {
  if (!url) return url;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

const formatTime = (dateString) => {
  if (!dateString) return '';
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

const getStatusConfig = (status) => {
  switch (status) {
    case 'completed':
      return { label: 'Đã hoàn thành', color: '#10B981' };
    case 'cancelled':
      return { label: 'Đã hủy', color: '#EF4444' };
    case 'full':
      return { label: 'Đang diễn ra', color: '#0B74FF' };
    case 'open':
    default:
      return { label: 'Sắp diễn ra', color: '#F5A623' };
  }
};

function getProfileErrorMessage(error, fallback) {
  if (typeof error === 'string') return error;
  return error?.message || fallback;
}

function getUserId(user) {
  if (!user) return null;
  return user._id || user.id || user.userId || user.user?._id || user.user?.id;
}

function getPostId(post) {
  return post?._id || post?.id;
}

function isPostOwner(currentUser, post) {
  if (!currentUser || !post) return false;
  const currentUserId = String(getUserId(currentUser) || '');
  const author = post.userId || post.createdBy || post.author || post.user;
  const authorId = typeof author === 'object' && author !== null
    ? String(author._id || author.id || '')
    : String(author || '');
  return Boolean(currentUserId && authorId && currentUserId === authorId);
}

function canNavigateToRoute(navigation, routeName) {
  let currentNavigation = navigation;
  while (currentNavigation) {
    const state = currentNavigation.getState?.();
    if (state?.routeNames?.includes(routeName)) return true;
    currentNavigation = currentNavigation.getParent?.();
  }
  return false;
}

export function ProfileScreen({ navigation, onLogout, onUpdateProfile, user }) {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const unreadCount = useSelector((state) => state.notifications.unreadCount);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOptionsSheetVisible, setIsOptionsSheetVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const scrollViewRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(240);
  const scrollOffsetRef = useRef(0);

  const handleSelectTab = (tabKey) => {
    if (tabKey === activeTab) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      if (tabKey === 'posts') {
        handleRefresh();
      }
    } else {
      setActiveTab(tabKey);
      if (scrollOffsetRef.current >= headerHeight) {
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollTo({ y: headerHeight, animated: false });
        });
      }
    }
  };

  // State điều khiển Modal xem danh sách Đánh giá
  const [showRatingsModal, setShowRatingsModal] = useState(false);

  const [editName, setEditName] = useState(user?.name ?? '');
  const [editPhone, setEditPhone] = useState(user?.phone ?? '');
  const [editBio, setEditBio] = useState(user?.bio ?? '');

  const authUser = useSelector((state) => state.auth.user);
  const displayProfile = useMemo(() => profile || user || authUser || {}, [profile, user, authUser]);
  const userId = getUserId(displayProfile) || getUserId(user) || getUserId(authUser);

  const savedPosts = useSelector((state) => state.posts?.savedPosts || []);
  const feedPosts = useSelector((state) => state.posts?.posts || []);
  const [myPosts, setMyPosts] = useState(() => feedPosts.filter((post) => {
    const author = post?.userId;
    const authorId = typeof author === 'object' ? getUserId(author) : author;
    return userId && String(authorId || '') === String(userId);
  }));
  const [myPostsLoading, setMyPostsLoading] = useState(false);
  const [historyMatches, setHistoryMatches] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [optionsPost, setOptionsPost] = useState(null);
  const [postToReport, setPostToReport] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const mergedMyPosts = useMemo(() => {
    const reduxPostsById = new Map([...feedPosts, ...savedPosts].map((post) => [getPostId(post), post]));
    return myPosts.map((post) => {
      const postId = getPostId(post);
      const reduxPost = reduxPostsById.get(postId);
      return reduxPost ? { ...post, ...reduxPost } : post;
    });
  }, [feedPosts, myPosts, savedPosts]);

  const patchMyPost = useCallback((postId, updater) => {
    setMyPosts((current) => current.map((post) => {
      if (getPostId(post) !== postId) return post;
      return typeof updater === 'function' ? updater(post) : { ...post, ...updater };
    }));
  }, []);

  const loadUserPosts = useCallback(async () => {
    if (!token || !userId) return;
    setMyPostsLoading(true);
    try {
      const res = await getPostsRequest(1, 50, token, null, userId);
      const postsList = res?.data || res?.posts || [];
      setMyPosts(Array.isArray(postsList) ? postsList : []);
    } catch (err) {
      console.log('Error loading user posts:', err);
    } finally {
      setMyPostsLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    if (activeTab === 'posts') {
      loadUserPosts();
    }
  }, [activeTab, loadUserPosts]);

  useFocusEffect(
    useCallback(() => {
      if (token && savedPosts.length === 0) {
        dispatch(fetchSavedPosts());
      }
      if (token && feedPosts.length === 0) {
        dispatch(fetchPosts({ page: 1, limit: 30 }));
      }
    }, [dispatch, feedPosts.length, savedPosts.length, token])
  );

  const loadHistoryMatches = useCallback(async () => {
    if (!token || !userId) return;
    setHistoryLoading(true);
    try {
      const res = await getMatches({ userId, participantId: userId, limit: 30, page: 1 }, token);
      const matchesList = Array.isArray(res) ? res : (res?.data || res?.matches || []);
      setHistoryMatches(Array.isArray(matchesList) ? matchesList : []);
    } catch (err) {
      console.log('Error loading history matches:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    if (activeTab === 'history' && historyMatches.length === 0) {
      loadHistoryMatches();
    }
  }, [activeTab, historyMatches.length, loadHistoryMatches]);

  const syncEditFormFromProfile = useCallback((source) => {
    const nextProfile = source || user || {};
    setEditName(nextProfile.name ?? '');
    setEditPhone(nextProfile.phone ?? '');
    setEditBio(nextProfile.bio ?? '');
  }, [user]);

  const loadProfile = useCallback(async ({ silent = false } = {}) => {
    if (!userId || !token) {
      setProfileLoading(false);
      return;
    }
    if (!silent) setProfileLoading(true);
    try {
      const profileResponse = await getUserProfileRequest(userId, token);
      const nextProfile = profileResponse?.data || profileResponse?.user || profileResponse;
      setProfile(nextProfile);
    } catch (error) {
      if (!silent) {
        Alert.alert('Lỗi', getProfileErrorMessage(error, 'Không thể tải hồ sơ.'));
      }
    } finally {
      setProfileLoading(false);
    }
  }, [token, userId]);

  useFocusEffect(
    useCallback(() => {
      loadProfile({ silent: true });
      if (token) dispatch(fetchUnreadCount());
    }, [dispatch, loadProfile, token])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadProfile({ silent: true }),
      loadUserPosts(),
      activeTab === 'history' ? loadHistoryMatches() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [activeTab, loadHistoryMatches, loadProfile, loadUserPosts]);

  const handleOpenPost = useCallback((post) => {
    navigation.navigate('PostDetail', { postId: getPostId(post), post });
  }, [navigation]);

  const handleOpenAuthor = useCallback((post) => {
    const author = post?.userId;
    const targetId = getUserId(author);
    if (!targetId) return;
    const myId = getUserId(authUser) || getUserId(user);
    if (myId && String(myId) === String(targetId)) return;
    navigation.navigate('UserProfile', { userId: targetId, initialProfile: author });
  }, [authUser, navigation, user]);

  const handleToggleLike = useCallback(async (post) => {
    const postId = getPostId(post);
    if (!postId) return;

    const previousPost = post;
    patchMyPost(postId, (current) => ({
      ...current,
      isLiked: !post.isLiked,
      reactionType: post.isLiked ? null : 'vibe',
      likesCount: Math.max(0, (current.likesCount || 0) + (post.isLiked ? -1 : 1)),
    }));

    try {
      const response = post.isLiked
        ? await dispatch(unlikePost(postId)).unwrap()
        : await dispatch(likePost({ postId, reactionType: 'vibe' })).unwrap();
      patchMyPost(postId, {
        isLiked: response.isLiked,
        reactionType: response.reactionType,
        likesCount: response.likesCount,
        topReactions: response.topReactions,
      });
    } catch (err) {
      patchMyPost(postId, previousPost);
      Alert.alert('Lỗi', err?.error || 'Không thể cập nhật cảm xúc.');
    }
  }, [dispatch, patchMyPost]);

  const handleToggleSave = useCallback((post) => {
    const postId = getPostId(post);
    const isSaved = post.isSaved || savedPosts.some((sp) => getPostId(sp) === postId);
    patchMyPost(postId, { isSaved: !isSaved });
    const action = isSaved ? unsavePost(postId) : savePost(postId);
    dispatch(action)
      .unwrap()
      .then(() => {
        Alert.alert('Thành công', isSaved ? 'Đã bỏ lưu bài viết.' : 'Đã lưu bài viết.');
        dispatch(fetchSavedPosts());
      })
      .catch((err) => {
        patchMyPost(postId, { isSaved });
        Alert.alert('Lỗi', err?.error || 'Không thể cập nhật trạng thái lưu bài viết.');
      });
  }, [dispatch, patchMyPost, savedPosts]);

  const handleDeletePost = useCallback((postId) => {
    Alert.alert('Xóa bài viết', 'Bạn có chắc chắn muốn xóa bài viết này không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          dispatch(deletePost(postId))
            .unwrap()
            .then(() => {
              Alert.alert('Thành công', 'Đã xóa bài viết.');
              setMyPosts((current) => current.filter((post) => getPostId(post) !== postId));
            })
            .catch((err) => {
              Alert.alert('Lỗi', err?.error || 'Không thể xóa bài viết.');
            });
        },
      },
    ]);
  }, [dispatch]);

  const handleShare = useCallback(async (post) => {
    try {
      const authorName = post.userId?.name || displayProfile?.name || 'Ai đó';
      const content = post.content?.trim() || '';
      const mediaLine = post.mediaUrls?.length > 0 ? `\n\nXem ảnh: ${fixMediaUrl(post.mediaUrls[0])}` : '';
      const message = content
        ? `${authorName} chia sẻ trên VibeSport: "${content}"${mediaLine}`
        : `${authorName} đã chia sẻ một bài viết trên VibeSport.${mediaLine}`;

      await Share.share(
        { title: 'VibeSport', message },
        { dialogTitle: 'Chia sẻ bài viết' },
      );
    } catch (error) {
      if (error?.message !== 'User did not share') {
        console.warn('Share error:', error?.message);
      }
    }
  }, [displayProfile]);

  const handleReportPost = useCallback(async (reason) => {
    if (!token || !postToReport) {
      setReportModalVisible(false);
      setPostToReport(null);
      return;
    }

    try {
      setReportModalVisible(false);
      await reportPostRequest(getPostId(postToReport), reason, token);
      setPostToReport(null);
      Alert.alert('Thành công', 'Cảm ơn bạn đã gửi báo cáo. Chúng tôi sẽ xem xét bài viết này sớm nhất có thể.');
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không thể gửi báo cáo.');
    }
  }, [postToReport, token]);

  const handleBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('Home', { screen: 'PostsTab' });
  };

  const openFollowList = (initialTab) => {
    navigation?.navigate('FollowList', {
      initialTab,
      userId,
      ownerName: displayProfile?.name || user?.name,
    });
  };

  const handlePickAvatar = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Cập nhật ảnh đại diện',
          message: 'Chọn phương thức để lấy ảnh',
          options: ['Hủy', 'Chụp ảnh mới', 'Chọn từ thư viện'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            processImagePick('camera');
          } else if (buttonIndex === 2) {
            processImagePick('library');
          }
        }
      );
    } else {
      Alert.alert(
        'Cập nhật ảnh đại diện',
        'Chọn phương thức để lấy ảnh',
        [
          { text: 'Chụp ảnh mới', onPress: () => processImagePick('camera') },
          { text: 'Chọn từ thư viện', onPress: () => processImagePick('library') },
          { text: 'Huỷ', style: 'cancel' },
        ]
      );
    }
  };

  const processImagePick = async (mode) => {
    try {
      let result;
      if (mode === 'camera') {
        const { status: permissionStatus } = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionStatus !== 'granted') {
          Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập máy ảnh để chụp ảnh.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.4,
          base64: true,
        });
      } else {
        const { status: permissionStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionStatus !== 'granted') {
          Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện để chọn ảnh.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.4,
          base64: true,
        });
      }

      if (result.canceled || !result.assets?.length) return;
      const selectedAsset = result.assets[0];
      if (!selectedAsset.base64) {
        Alert.alert('Lỗi', 'Không đọc được dữ liệu ảnh. Vui lòng thử lại.');
        return;
      }

      const mimeType = selectedAsset.mimeType || 'image/jpeg';
      const base64Image = `data:${mimeType};base64,${selectedAsset.base64}`;

      setIsSaving(true);
      const updatedUser = await onUpdateProfile({ userId, picture: base64Image });
      setProfile((current) => ({ ...(current || {}), ...(updatedUser || {}), picture: base64Image }));
      Alert.alert('Thành công', 'Cập nhật ảnh đại diện thành công.');
    } catch (error) {
      Alert.alert('Lỗi', getProfileErrorMessage(error, 'Cập nhật ảnh đại diện thất bại.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Lỗi', 'Tên hiển thị không được bỏ trống.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await onUpdateProfile({
        userId,
        name: editName.trim(),
        phone: editPhone.trim(),
        bio: editBio.trim(),
      });

      setProfile((current) => ({ ...(current || {}), ...(updatedUser || {}) }));
      syncEditFormFromProfile({ ...(displayProfile || {}), ...(updatedUser || {}) });
      Alert.alert('Thành công', 'Cập nhật hồ sơ thành công.');
      setIsEditModalVisible(false);
    } catch (error) {
      Alert.alert('Lỗi', getProfileErrorMessage(error, 'Cập nhật thông tin hồ sơ thất bại.'));
    } finally {
      setIsSaving(false);
    }
  };

  const closeOptionsSheet = () => setIsOptionsSheetVisible(false);

  const handleOpenManagement = (routeName, title) => {
    closeOptionsSheet();
    if (!canNavigateToRoute(navigation, routeName)) {
      Alert.alert('Chức năng đang cập nhật', `Màn hình "${title}" đang được cấu hình và phát triển.`);
      return;
    }
    navigation.navigate(routeName);
  };

  const handleEditProfile = () => {
    closeOptionsSheet();
    syncEditFormFromProfile(displayProfile);
    setIsEditModalVisible(true);
  };

  const handleOpenSavedPosts = () => {
    closeOptionsSheet();
    if (canNavigateToRoute(navigation, 'SavedPosts')) {
      navigation.navigate('SavedPosts');
      return;
    }
    Alert.alert('Lưu bài viết', 'Màn bài viết đã lưu chưa được cấu hình.');
  };

  const handleOpenSettings = () => {
    closeOptionsSheet();
    navigation.navigate('Settings');
  };

  const handleRequestLogout = () => {
    closeOptionsSheet();
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất không?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              await onLogout?.();
            } catch (error) {
              Alert.alert('Lỗi', getProfileErrorMessage(error, 'Không thể đăng xuất.'));
            }
          },
        },
      ]
    );
  };

  const managementCards = useMemo(() => [
    {
      key: 'profile-management',
      title: 'Bài viết của tôi',
      subtitle: 'Xem, chỉnh sửa thông tin chi tiết cá nhân',
      iconName: 'person-outline',
      routeName: 'ProfileManagementScreen',
    },
    {
      key: 'club-management',
      title: 'FC của tôi',
      subtitle: 'Xem các câu lạc bộ thể thao bạn đã tham gia',
      iconName: 'people-outline',
      routeName: 'ClubManagementScreen',
    },
    {
      key: 'match-history',
      title: 'Lịch sử hoạt động',
      subtitle: 'Thống kê kết quả các trận đấu đã chơi',
      iconName: 'time-outline',
      routeName: 'MatchHistoryScreen',
    },
  ], []);

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={background.primary} />
      <ScreenHeader style={styles.headerBar}>
        <View style={styles.headerBrand}>
          <Image
            source={require('../../assets/logovibe_tachnen.png')}
            style={styles.headerLogo}
            resizeMode="contain"
            fadeDuration={0}
          />
          <Text style={styles.headerTitle}>
            Hồ<Text style={styles.headerTitleOrange}>Sơ</Text>
          </Text>
        </View>
        <View style={styles.headerRightSide}>
          <HeaderIconButton onPress={() => setIsOptionsSheetVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={spacing.xl} color={icon.dark} />
          </HeaderIconButton>
        </View>
      </ScreenHeader>

      {profileLoading && !getUserId(displayProfile) ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={primary.DEFAULT} />
          <Text style={styles.emptyText}>Đang tải hồ sơ...</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[1]}
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primary.DEFAULT} />}
        >
          {/* Child 0: Thông tin cá nhân (Avatar + Bio) */}
          <View
            style={styles.profileInfoCardBox}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) setHeaderHeight(h);
            }}
          >
            <ProfileHeaderCard
              profile={displayProfile}
              isSelf={true}
              onOpenFollowList={openFollowList}
              onPickAvatar={handlePickAvatar}
              onOpenRatings={() => setShowRatingsModal(true)}
            />
          </View>

          {/* Child 1: Thanh Tab Bar Sticky cố định khi cuộn */}
          <View style={styles.stickyTabBarWrap}>
            <ProfileTabBar activeTab={activeTab} onSelectTab={handleSelectTab} />
          </View>

          {/* Child 2: Nội dung bài viết / bài đã lưu / lịch sử */}
          <View style={styles.tabContentCardBox}>

            {activeTab === 'posts' && (
              <View>
                {myPostsLoading && mergedMyPosts.length === 0 ? (
                  <ActivityIndicator size="small" color={primary.DEFAULT} style={{ marginVertical: 20 }} />
                ) : mergedMyPosts.length > 0 ? (
                  mergedMyPosts.map((post) => (
                    <ProfilePostCard
                      key={post._id || post.id}
                      post={post}
                      profile={displayProfile}
                      onOpenPost={handleOpenPost}
                      onOpenAuthor={handleOpenAuthor}
                      onToggleLike={handleToggleLike}
                      onShare={handleShare}
                      onOpenMenu={(p) => setOptionsPost(p)}
                    />
                  ))
                ) : (
                  <View style={styles.emptyTabBox}>
                    <Ionicons name="newspaper-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyTabTitle}>Chưa có bài viết nào</Text>
                    <Text style={styles.emptyTabSub}>Các bài viết bạn đăng trên Cộng đồng sẽ xuất hiện ở đây.</Text>

                  </View>
                )}
              </View>
            )}

            {activeTab === 'saved' && (
              <View>
                {savedPosts.length > 0 ? (
                  savedPosts.map((post) => (
                    <ProfilePostCard
                      key={post._id || post.id}
                      post={post}
                      profile={displayProfile}
                      onOpenPost={handleOpenPost}
                      onOpenAuthor={handleOpenAuthor}
                      onToggleLike={handleToggleLike}
                      onShare={handleShare}
                      onOpenMenu={(p) => setOptionsPost(p)}
                    />
                  ))
                ) : (
                  <View style={styles.emptyTabBox}>
                    <Ionicons name="bookmark-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyTabTitle}>Chưa có bài viết đã lưu</Text>
                    <Text style={styles.emptyTabSub}>Nhấn dấu ba chấm trên bài viết để lưu lại và xem sau.</Text>
                  </View>
                )}
              </View>
            )}

            {activeTab === 'history' && (
              <View>
                {historyLoading ? (
                  <ActivityIndicator size="small" color={primary.DEFAULT} style={{ marginVertical: 20 }} />
                ) : historyMatches.length > 0 ? (
                  historyMatches.map((match) => {
                    const statusConfig = getStatusConfig(match.status);
                    return (
                      <TouchableOpacity
                        key={match._id || match.id}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate('MatchDetail', { matchId: match._id || match.id })}
                        style={styles.inlineMatchCard}
                      >
                        <View style={styles.inlineMatchTopRow}>
                          <Text style={styles.inlineMatchTitle} numberOfLines={1}>{match.title || match.sport}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}15` }]}>
                            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                          </View>
                        </View>
                        <Text style={styles.inlineMatchSub} numberOfLines={1}>📍 {match.locationName || 'Sân thi đấu'}</Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyTabBox}>
                    <Ionicons name="time-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyTabTitle}>Chưa có lịch sử trận đấu</Text>
                    <Text style={styles.emptyTabSub}>Các trận đấu bạn đã tham gia hoặc tạo sẽ xuất hiện ở đây.</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Modal hiển thị danh sách đánh giá */}
      <RatingsListModal
        visible={showRatingsModal}
        onClose={() => setShowRatingsModal(false)}
        userId={userId}
        token={token}
      />

      <ProfileOptionsSheet
        visible={isOptionsSheetVisible}
        onClose={closeOptionsSheet}
        onEditProfile={handleEditProfile}
        onSavedPosts={handleOpenSavedPosts}
        onSettings={handleOpenSettings}
        onLogout={handleRequestLogout}
      />

      <EditProfileModal
        visible={isEditModalVisible}
        user={displayProfile}
        editName={editName}
        setEditName={setEditName}
        editPhone={editPhone}
        setEditPhone={setEditPhone}
        editBio={editBio}
        setEditBio={setEditBio}
        onPickAvatar={handlePickAvatar}
        onClose={() => setIsEditModalVisible(false)}
        onSave={handleSaveProfile}
        saving={isSaving}
      />

      {isSaving ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={primary.DEFAULT} />
          <Text style={styles.loadingOverlayText}>Đang lưu thay đổi...</Text>
        </View>
      ) : null}

      {/* Bottom sheet for post options */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={optionsPost !== null}
        onRequestClose={() => setOptionsPost(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setOptionsPost(null)}
          style={styles.sheetOverlay}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Tùy chọn bài viết</Text>

            {optionsPost && (
              <>
                <TouchableOpacity
                  onPress={() => {
                    const post = optionsPost;
                    setOptionsPost(null);
                    handleToggleSave(post);
                  }}
                  style={styles.sheetOption}
                >
                  <Ionicons
                    name={optionsPost.isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={icon.dark}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={styles.sheetOptionText}>
                    {(optionsPost.isSaved || savedPosts.some((sp) => getPostId(sp) === getPostId(optionsPost)))
                      ? 'Bỏ lưu bài viết'
                      : 'Lưu bài viết'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.sheetDivider} />

                {isPostOwner(authUser || user, optionsPost) ? (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        const post = optionsPost;
                        setOptionsPost(null);
                        navigation.navigate('CreatePost', { editPost: post });
                      }}
                      style={styles.sheetOption}
                    >
                      <Ionicons name="create-outline" size={20} color={icon.dark} style={{ marginRight: 12 }} />
                      <Text style={styles.sheetOptionText}>Sửa bài viết</Text>
                    </TouchableOpacity>
                    <View style={styles.sheetDivider} />

                    <TouchableOpacity
                      onPress={() => {
                        const postId = getPostId(optionsPost);
                        setOptionsPost(null);
                        handleDeletePost(postId);
                      }}
                      style={styles.sheetOption}
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                      <Text style={[styles.sheetOptionText, styles.sheetOptionTextDanger]}>Xóa bài viết</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      const post = optionsPost;
                      setOptionsPost(null);
                      setPostToReport(post);
                      setReportModalVisible(true);
                    }}
                    style={styles.sheetOption}
                  >
                    <Ionicons name="flag-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                    <Text style={[styles.sheetOptionText, styles.sheetOptionTextDanger]}>Báo cáo bài viết</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
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
