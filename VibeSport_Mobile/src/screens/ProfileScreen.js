import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Share,
  StatusBar,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { fetchUnreadCount } from '../redux/notificationSlice';
import { likePost, unlikePost } from '../redux/postSlice';
import { getPostsRequest } from '../services/postApi';
import { getUserProfileRequest, getUserTeamsRequest } from '../services/userApi';
import { background, icon, primary, spacing } from '../theme';
import {
  EditProfileModal,
  EmptyState,
  HeaderIconButton,
  InfoCard,
  POSITION_OPTIONS,
  ProfileHeaderCard,
  ProfileOptionsSheet,
  ProfilePostCard,
  ProfileTabs,
  SPORTS,
  StatsCard,
  TeamCard,
  fixMediaUrl,
} from '../components/ProfileScreenComponents';
import { styles } from './ProfileScreen.styles';

function getProfileErrorMessage(error, fallback) {
  if (typeof error === 'string') return error;
  return error?.message || fallback;
}

const POST_PAGE_SIZE = 20;

function getUserId(user) {
  return user?.id || user?._id;
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


export function ProfileScreen({ onLogout, onUpdateProfile, navigation, user }) {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const unreadCount = useSelector((state) => state.notifications.unreadCount);

  const [profile, setProfile] = useState(null);
  const [teams, setTeams] = useState({ active: [], past: [] });
  const [posts, setPosts] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOptionsSheetVisible, setIsOptionsSheetVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');

  const [editName, setEditName] = useState(user?.name ?? '');
  const [editPhone, setEditPhone] = useState(user?.phone ?? '');
  const [editFavoriteSport, setEditFavoriteSport] = useState(user?.favoriteSport ?? SPORTS[0].key);
  const [editPosition, setEditPosition] = useState(user?.position ?? POSITION_OPTIONS[SPORTS[0].key][0]);
  const [editArea, setEditArea] = useState(user?.area ?? '');
  const [editBio, setEditBio] = useState(user?.bio ?? '');

  const displayProfile = profile || user || {};
  const userId = getUserId(user);

  useEffect(() => {
    const nextProfile = profile || user;
    if (!nextProfile) return;

    setEditName(nextProfile.name ?? '');
    setEditPhone(nextProfile.phone ?? '');
    setEditFavoriteSport(nextProfile.favoriteSport ?? SPORTS[0].key);
    setEditPosition(nextProfile.position ?? POSITION_OPTIONS[nextProfile.favoriteSport || SPORTS[0].key]?.[0] ?? '');
    setEditArea(nextProfile.area ?? '');
    setEditBio(nextProfile.bio ?? '');
  }, [profile, user]);

  const loadProfile = useCallback(async () => {
    if (!userId || !token) return;

    const [profileResponse, teamsResponse] = await Promise.all([
      getUserProfileRequest(userId, token),
      getUserTeamsRequest(userId, token),
    ]);

    setProfile(profileResponse.data);
    setTeams(teamsResponse.data || { active: [], past: [] });
  }, [token, userId]);

  const loadPosts = useCallback(async () => {
    if (!userId || !token) return;

    const response = await getPostsRequest(1, POST_PAGE_SIZE, token, null, userId);
    setPosts(response.data || []);
  }, [token, userId]);

  const loadAll = useCallback(async ({ showLoading = false } = {}) => {
    if (!userId || !token) {
      setProfileLoading(false);
      setPostsLoading(false);
      setRefreshing(false);
      return;
    }

    if (showLoading) setProfileLoading(true);
    setPostsLoading(true);

    try {
      await Promise.all([loadProfile(), loadPosts()]);
    } catch (error) {
      Alert.alert('Lỗi', getProfileErrorMessage(error, 'Không thể tải hồ sơ.'));
    } finally {
      setProfileLoading(false);
      setPostsLoading(false);
      setRefreshing(false);
    }
  }, [loadPosts, loadProfile, token, userId]);

  useFocusEffect(
    useCallback(() => {
      loadAll({ showLoading: !profile });
      if (token) {
        dispatch(fetchUnreadCount());
      }
    }, [dispatch, loadAll, profile, token])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  const handleBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('PostsTab');
  };

  const openFollowList = (initialTab) => {
    navigation?.navigate('FollowList', { initialTab });
  };

  const handlePickAvatar = () => {
    Alert.alert(
      'Cập nhật ảnh đại diện',
      'Chọn phương thức để lấy ảnh',
      [
        { text: 'Chụp ảnh mới', onPress: () => setTimeout(() => processImagePick('camera'), 150) },
        { text: 'Chọn từ thư viện', onPress: () => setTimeout(() => processImagePick('library'), 150) },
        { text: 'Huỷ', style: 'cancel' },
      ]
    );
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

      if (!userId) {
        Alert.alert('Lỗi', 'Không xác định được tài khoản. Vui lòng đăng nhập lại.');
        return;
      }

      const mimeType = selectedAsset.mimeType || 'image/jpeg';
      const base64Image = `data:${mimeType};base64,${selectedAsset.base64}`;

      setIsSaving(true);
      const updatedUser = await onUpdateProfile({
        userId,
        picture: base64Image,
      });
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

    if (!userId) {
      Alert.alert('Lỗi', 'Không xác định được tài khoản. Vui lòng đăng nhập lại.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await onUpdateProfile({
        userId,
        name: editName.trim(),
        phone: editPhone.trim(),
        favoriteSport: editFavoriteSport,
        position: editPosition,
        area: editArea.trim(),
        bio: editBio.trim(),
      });

      setProfile((current) => ({
        ...(current || {}),
        ...(updatedUser || {}),
      }));
      Alert.alert('Thành công', 'Cập nhật hồ sơ thành công.');
      setIsEditModalVisible(false);
      loadProfile();
    } catch (error) {
      Alert.alert('Lỗi', getProfileErrorMessage(error, 'Cập nhật thông tin hồ sơ thất bại.'));
    } finally {
      setIsSaving(false);
    }
  };

  const closeOptionsSheet = () => setIsOptionsSheetVisible(false);

  const handleEditProfile = () => {
    closeOptionsSheet();
    if (canNavigateToRoute(navigation, 'EditProfile')) {
      navigation.navigate('EditProfile');
      return;
    }

    // TODO: Navigate to EditProfile when the route is added to MainNavigator.
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
    if (canNavigateToRoute(navigation, 'Settings')) {
      navigation.navigate('Settings');
      return;
    }

    // TODO: Navigate to Settings when the route is added to MainNavigator.
    Alert.alert('Cài đặt', 'Màn Cài đặt chưa được cấu hình.');
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

  const handleToggleLike = async (post) => {
    try {
      const action = post.isLiked
        ? unlikePost(post._id)
        : likePost({ postId: post._id, reactionType: 'vibe' });
      const result = await dispatch(action).unwrap();

      setPosts((currentPosts) =>
        currentPosts.map((item) =>
          item._id === result.postId
            ? {
                ...item,
                isLiked: result.isLiked,
                reactionType: result.reactionType,
                likesCount: result.likesCount,
                topReactions: result.topReactions,
              }
            : item
        )
      );
    } catch (error) {
      Alert.alert('Lỗi', error?.error || error?.message || 'Không thể cập nhật Like.');
    }
  };

  const handleOpenPost = (post) => {
    navigation?.navigate('PostDetail', { postId: post._id });
  };

  const handleShare = async (post) => {
    try {
      const authorName = post.userId?.name || displayProfile.name || 'Thành viên VibeSport';
      const content = post.content?.trim() || '';
      const mediaLine = post.mediaUrls?.length ? `\n\nXem ảnh: ${fixMediaUrl(post.mediaUrls[0])}` : '';
      const message = content
        ? `${authorName} chia sẻ trên VibeSport: "${content}"${mediaLine}`
        : `${authorName} đã chia sẻ một bài viết trên VibeSport.${mediaLine}`;

      await Share.share(
        { title: 'VibeSport', message },
        { dialogTitle: 'Chia sẻ bài viết' }
      );
    } catch (error) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Lỗi', 'Không thể chia sẻ bài viết.');
      }
    }
  };

  const listData = activeTab === 'posts'
    ? posts
    : activeTab === 'fc'
    ? teams.active || []
    : teams.past || [];

  const renderHeader = () => (
    <View>
      <ProfileHeaderCard profile={displayProfile} onPickAvatar={handlePickAvatar} />
      <StatsCard profile={displayProfile} onOpenFollowList={openFollowList} />
      <InfoCard profile={displayProfile} />
      <ProfileTabs activeTab={activeTab} onChangeTab={setActiveTab} />
    </View>
  );

  const renderItem = ({ item }) => {
    if (activeTab === 'posts') {
      return (
        <ProfilePostCard
          post={item}
          profile={displayProfile}
          onOpenPost={handleOpenPost}
          onToggleLike={handleToggleLike}
          onShare={handleShare}
        />
      );
    }

    return <TeamCard team={item} />;
  };

  const renderEmpty = () => {
    if (activeTab === 'posts') {
      return (
        <EmptyState
          iconName="document-text-outline"
          title="Chưa có bài viết"
          loading={postsLoading && !refreshing}
        />
      );
    }

    if (activeTab === 'fc') {
      return <EmptyState iconName="shield-outline" title="Chưa có FC" />;
    }

    return <EmptyState iconName="people-outline" title="Chưa có đội" />;
  };

  const renderMainContent = () => {
    if (profileLoading && !profile && !user) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={primary.DEFAULT} />
          <Text style={styles.emptyText}>Đang tải hồ sơ...</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={listData}
        keyExtractor={(item) => activeTab === 'posts' ? item._id : String(item.teamId || item.name)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[primary.DEFAULT]}
            tintColor={primary.DEFAULT}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={background.primary} />

      <ScreenHeader style={styles.headerBar}>
        <View style={styles.headerSide}>
          <HeaderIconButton onPress={handleBack}>
            <Ionicons name="arrow-back" size={spacing.xl} color={icon.dark} />
          </HeaderIconButton>
        </View>

        <Text style={styles.headerTitle}>Hồ Sơ</Text>

        <View style={[styles.headerSide, styles.headerRightSide]}>
          <HeaderIconButton onPress={() => setIsOptionsSheetVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={spacing.xl} color={icon.dark} />
          </HeaderIconButton>
          <HeaderIconButton onPress={() => navigation?.navigate('Notification')}>
            <View style={styles.notificationIconWrap}>
              <Ionicons name="notifications-outline" size={spacing.xl} color={icon.dark} />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge} />
              ) : null}
            </View>
          </HeaderIconButton>
        </View>
      </ScreenHeader>

      {renderMainContent()}

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
        editFavoriteSport={editFavoriteSport}
        setEditFavoriteSport={setEditFavoriteSport}
        editPosition={editPosition}
        setEditPosition={setEditPosition}
        editArea={editArea}
        setEditArea={setEditArea}
        editBio={editBio}
        setEditBio={setEditBio}
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
    </Screen>
  );
}
