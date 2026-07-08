import { useCallback, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { fetchUnreadCount } from '../redux/notificationSlice';
import { getUserProfileRequest } from '../services/userApi';
import { background, icon, primary, spacing } from '../theme';
import {
  EditProfileModal,
  HeaderIconButton,
  InfoCard,
  POSITION_OPTIONS,
  ProfileHeaderCard,
  ProfileOptionsSheet,
  SPORTS,
  StatsCard,
} from '../components/ProfileScreenComponents';
import { styles } from './ProfileScreen.styles';

function getProfileErrorMessage(error, fallback) {
  if (typeof error === 'string') return error;
  return error?.message || fallback;
}

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
  const [profileLoading, setProfileLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOptionsSheetVisible, setIsOptionsSheetVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editName, setEditName] = useState(user?.name ?? '');
  const [editPhone, setEditPhone] = useState(user?.phone ?? '');
  const [editFavoriteSport, setEditFavoriteSport] = useState(user?.favoriteSport ?? SPORTS[0].key);
  const [editPosition, setEditPosition] = useState(user?.position ?? POSITION_OPTIONS[SPORTS[0].key][0]);
  const [editArea, setEditArea] = useState(user?.area ?? '');
  const [editBio, setEditBio] = useState(user?.bio ?? '');

  const profileLoadedRef = useRef(false);
  const profileRequestRef = useRef(null);

  const displayProfile = useMemo(() => profile || user || {}, [profile, user]);
  const userId = getUserId(user);

  const syncEditFormFromProfile = useCallback((source) => {
    const nextProfile = source || user || {};
    setEditName(nextProfile.name ?? '');
    setEditPhone(nextProfile.phone ?? '');
    setEditFavoriteSport(nextProfile.favoriteSport ?? SPORTS[0].key);
    setEditPosition(nextProfile.position ?? POSITION_OPTIONS[nextProfile.favoriteSport || SPORTS[0].key]?.[0] ?? '');
    setEditArea(nextProfile.area ?? '');
    setEditBio(nextProfile.bio ?? '');
  }, [user]);

  const loadProfile = useCallback(async ({ silent = false, force = false } = {}) => {
    if (!userId || !token) {
      setProfileLoading(false);
      return null;
    }
    if (!force && profileLoadedRef.current && !profileRequestRef.current) {
      return profile;
    }
    if (!silent) setProfileLoading(true);
    if (profileRequestRef.current) return profileRequestRef.current;

    profileRequestRef.current = (async () => {
      const profileResponse = await getUserProfileRequest(userId, token);
      const nextProfile = profileResponse?.data || profileResponse?.user || profileResponse;
      setProfile(nextProfile);
      profileLoadedRef.current = true;
      return nextProfile;
    })()
      .catch((error) => {
        Alert.alert('Lỗi', getProfileErrorMessage(error, 'Không thể tải hồ sơ.'));
        throw error;
      })
      .finally(() => {
        setProfileLoading(false);
        profileRequestRef.current = null;
      });

    return profileRequestRef.current;
  }, [profile, token, userId]);

  useFocusEffect(
    useCallback(() => {
      loadProfile({ silent: true, force: true });
      if (token) dispatch(fetchUnreadCount());
    }, [dispatch, loadProfile, token])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadProfile({ force: true, silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile]);

  const handleBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('PostsTab');
  };

  const openFollowList = (initialTab) => {
    navigation?.navigate('FollowList', {
      initialTab,
      userId,
      ownerName: displayProfile?.name || user?.name,
    });
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
      Alert.alert('Chức năng đang cập nhật', `Màn hình "${title}" đang được phát triển và cấu hình.`);
      return;
    }
    navigation.navigate(routeName);
  };

  const handleEditProfile = () => {
    closeOptionsSheet();
    if (canNavigateToRoute(navigation, 'EditProfile')) {
      navigation.navigate('EditProfile');
      return;
    }
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
    if (canNavigateToRoute(navigation, 'Settings')) {
      navigation.navigate('Settings');
      return;
    }
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

  const managementCards = useMemo(() => [
    {
      key: 'profile-management',
      title: 'Quản lý trang cá nhân',
      subtitle: 'Xem, chỉnh sửa thông tin chi tiết cá nhân',
      iconName: 'person-outline',
      routeName: 'ProfileManagementScreen',
    },
    {
      key: 'club-management',
      title: 'Quản lý FC',
      subtitle: 'Quản lý câu lạc bộ thể thao của bạn',
      iconName: 'people-outline',
      routeName: 'ClubManagementScreen',
    },
    {
      key: 'match-history',
      title: 'Lịch sử trận đấu',
      subtitle: 'Thống kê kết quả các trận đấu đã chơi',
      iconName: 'time-outline',
      routeName: 'MatchHistoryScreen',
    },
  ], []);

  const renderMainContent = useCallback(() => {
    if (profileLoading && !profile && !user) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={primary.DEFAULT} />
          <Text style={styles.emptyText}>Đang tải hồ sơ...</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primary.DEFAULT} />}
      >
        <ProfileHeaderCard profile={displayProfile} onPickAvatar={handlePickAvatar} />
        <StatsCard profile={displayProfile} onOpenFollowList={openFollowList} />
        <InfoCard profile={displayProfile} />

        {managementCards.map((card) => (
          <TouchableOpacity
            key={card.key}
            activeOpacity={0.8}
            onPress={() => handleOpenManagement(card.routeName, card.title)}
            style={styles.managementCard}
          >
            <View style={styles.managementCardLeft}>
              <View style={styles.managementCardIconWrap}>
                <Ionicons name={card.iconName} size={spacing.xl} color={primary.DEFAULT} />
              </View>
              <View style={styles.managementCardTextBlock}>
                <Text style={styles.managementCardTitle}>{card.title}</Text>
                <Text style={styles.managementCardSubtitle}>{card.subtitle}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={icon.dark} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }, [displayProfile, handlePickAvatar, managementCards, profile, profileLoading, user, refreshing, handleRefresh]);

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
              {unreadCount > 0 ? <View style={styles.notificationBadge} /> : null}
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