import { useState, useEffect, useCallback } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  Modal,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getUserProfileRequest } from '../services/userApi';
import { ScreenHeader } from '../components/ScreenHeader';

const SPORTS = [
  { key: 'Bóng đá', label: 'Bóng đá' },
  { key: 'Cầu lông', label: 'Cầu lông' },
  { key: 'Pickleball', label: 'Pickleball' },
];

const POSITION_OPTIONS = {
  'Bóng đá': ['Tiền đạo', 'Tiền vệ', 'Hậu vệ', 'Thủ môn'],
  'Cầu lông': ['Đơn', 'Đôi', 'Đôi nam', 'Đôi nữ'],
  Pickleball: ['Forehand', 'Backhand', 'Đôi'],
};

function getProfileErrorMessage(error, fallback) {
  if (typeof error === 'string') return error;
  return error?.message || fallback;
}

function getUserId(user) {
  return user?.id || user?._id;
}

const SPORT_EMOJIS = {
  'Bóng đá': '⚽',
  'Cầu lông': '🏸',
  Pickleball: '🏓',
};

export function ProfileScreen({ onLogout, onUpdateProfile, navigation, user }) {
  const token = useSelector((state) => state.auth.token);
  const [profileStats, setProfileStats] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? '');
  const [editPhone, setEditPhone] = useState(user?.phone ?? '');
  const [editFavoriteSport, setEditFavoriteSport] = useState(user?.favoriteSport ?? 'Bóng đá');
  const [editPosition, setEditPosition] = useState(user?.position ?? 'Tiền đạo');
  const [editArea, setEditArea] = useState(user?.area ?? '');
  const [editBio, setEditBio] = useState(user?.bio ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'achievements' | 'teams'

  useEffect(() => {
    if (user) {
      setEditName(user.name ?? '');
      setEditPhone(user.phone ?? '');
      setEditFavoriteSport(user.favoriteSport ?? 'Bóng đá');
      setEditPosition(user.position ?? 'Tiền đạo');
      setEditArea(user.area ?? '');
      setEditBio(user.bio ?? '');
    }
  }, [user]);

  const loadProfileStats = useCallback(async () => {
    const userId = getUserId(user);
    if (!userId || !token) return;

    try {
      const response = await getUserProfileRequest(userId, token);
      setProfileStats(response.data);
    } catch (error) {
      console.error('Load profile stats error:', error);
    }
  }, [user, token]);

  useFocusEffect(
    useCallback(() => {
      loadProfileStats();
    }, [loadProfileStats])
  );

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
        { text: 'Hủy', style: 'cancel' }
      ]
    );
  };

  const processImagePick = async (mode) => {
    try {
      let result;
      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
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
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
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

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        if (!selectedAsset.base64) {
          Alert.alert('Lỗi', 'Không đọc được dữ liệu ảnh. Vui lòng thử lại.');
          return;
        }

        const userId = getUserId(user);
        if (!userId) {
          Alert.alert('Lỗi', 'Không xác định được tài khoản. Vui lòng đăng nhập lại.');
          return;
        }

        const mimeType = selectedAsset.mimeType || 'image/jpeg';
        const base64Image = `data:${mimeType};base64,${selectedAsset.base64}`;

        setIsSaving(true);
        try {
          await onUpdateProfile({
            userId,
            picture: base64Image,
          });
          Alert.alert('Thành công', 'Cập nhật ảnh đại diện thành công.');
        } catch (error) {
          Alert.alert('Lỗi', getProfileErrorMessage(error, 'Cập nhật ảnh đại diện thất bại.'));
        } finally {
          setIsSaving(false);
        }
      }
    } catch (err) {
      setIsSaving(false);
      console.error('Lỗi khi xử lý chọn ảnh:', err);
      Alert.alert('Lỗi', 'Không thể chọn ảnh.');
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Lỗi', 'Tên hiển thị không được bỏ trống.');
      return;
    }
    
    const userId = getUserId(user);
    if (!userId) {
      Alert.alert('Lỗi', 'Không xác định được tài khoản. Vui lòng đăng nhập lại.');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateProfile({
        userId,
        name: editName.trim(),
        phone: editPhone.trim(),
        favoriteSport: editFavoriteSport,
        position: editPosition,
        area: editArea.trim(),
        bio: editBio.trim(),
      });
      Alert.alert('Thành công', 'Cập nhật hồ sơ thành công.');
      setIsEditModalVisible(false);
      loadProfileStats();
    } catch (error) {
      Alert.alert('Lỗi', getProfileErrorMessage(error, 'Cập nhật thông tin hồ sơ thất bại.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoreOptions = () => {
    Alert.alert(
      "Tùy chọn",
      null,
      [
        { text: "✏️ Chỉnh sửa hồ sơ", onPress: () => setIsEditModalVisible(true) },
        { text: "🚪 Đăng xuất", style: "destructive", onPress: onLogout },
        { text: "Hủy", style: "cancel" }
      ],
      { cancelable: true }
    );
  };

  const getCleanArea = (fullArea) => {
    if (!fullArea) return "Chưa chọn";
    const parts = fullArea.split(",");
    // Return last part (usually city) or first part depending on length
    return parts[parts.length - 1]?.trim() || fullArea;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Redesigned Screen Header matching the mockup */}
      <ScreenHeader style={styles.screenHeader}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => {
            if (navigation?.canGoBack()) navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#e14f2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.headerMoreBtn} onPress={handleMoreOptions}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#e14f2e" />
        </TouchableOpacity>
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Profile Card Info */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={styles.avatarWrapper}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={styles.defaultAvatar}>
                <Text style={styles.defaultAvatarText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Feather name="edit-2" size={12} color="#ffffff" />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.displayName}>
            {user?.name || user?.email?.split('@')[0] || 'Người dùng VibeSport'}
          </Text>
          <Text style={styles.emailText}>{user?.email}</Text>

          {/* Active Status Pill */}
          <View style={styles.activeStatusPill}>
            <View style={styles.activeDot} />
            <Text style={styles.activeStatusText}>Đang hoạt động</Text>
          </View>
        </View>

        {/* 2x2 Grid Statistics Box */}
        <View style={styles.statsGridContainer}>
          <View style={styles.gridRow}>
            <TouchableOpacity style={styles.gridCell} onPress={() => openFollowList('following')}>
              <Text style={styles.gridValue}>{profileStats?.followingCount ?? 0}</Text>
              <Text style={styles.gridLabel}>Đang theo dõi</Text>
            </TouchableOpacity>
            <View style={styles.gridVerticalDivider} />
            <TouchableOpacity style={styles.gridCell} onPress={() => openFollowList('followers')}>
              <Text style={styles.gridValue}>{profileStats?.followerCount ?? 0}</Text>
              <Text style={styles.gridLabel}>Người theo dõi</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gridHorizontalDivider} />

          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Text style={styles.gridValue}>{profileStats?.stats?.matchesPlayed ?? 0}</Text>
              <Text style={styles.gridLabel}>Trận đã chơi</Text>
            </View>
            <View style={styles.gridVerticalDivider} />
            <View style={styles.gridCell}>
              <View style={styles.ratingValueWrap}>
                <Text style={styles.gridValue}>
                  {((profileStats?.stats?.rating ?? user?.rating ?? 5.0)).toFixed(1)}
                </Text>
                <Ionicons name="star" size={14} color="#cbd5e1" style={styles.ratingStarIcon} />
              </View>
              <Text style={styles.gridLabel}>Đánh giá</Text>
            </View>
          </View>
        </View>

        {/* Highlights Row Redesigned to stack vertically (column) */}
        <View style={styles.highlightsColumnContainer}>
          {/* Card 1: Favorite Sport */}
          <View style={styles.highlightCardRow}>
            <View style={[styles.highlightIconWrap, { backgroundColor: '#fff7ed' }]}>
              <Text style={styles.highlightEmoji}>
                {SPORT_EMOJIS[user?.favoriteSport] || '⚽'}
              </Text>
            </View>
            <View style={styles.highlightTextWrap}>
              <Text style={styles.highlightTitle}>Môn thể thao</Text>
              <Text style={styles.highlightValue}>
                {user?.favoriteSport || 'Bóng đá'}
              </Text>
            </View>
          </View>

          {/* Card 2: Playing Position */}
          <View style={styles.highlightCardRow}>
            <View style={[styles.highlightIconWrap, { backgroundColor: '#fff1f2' }]}>
              <Ionicons name="git-network-outline" size={20} color="#e11d48" />
            </View>
            <View style={styles.highlightTextWrap}>
              <Text style={styles.highlightTitle}>Vị trí</Text>
              <Text style={styles.highlightValue}>
                {user?.position || 'Tiền đạo'}
              </Text>
            </View>
          </View>

          {/* Card 3: Selected Area */}
          <View style={styles.highlightCardRow}>
            <View style={[styles.highlightIconWrap, { backgroundColor: '#ecfdf5' }]}>
              <Ionicons name="location-outline" size={20} color="#10b981" />
            </View>
            <View style={styles.highlightTextWrap}>
              <Text style={styles.highlightTitle}>Khu vực</Text>
              <Text style={styles.highlightValue}>
                {user?.area || 'Hà Nội'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tabs Bar Segment */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'posts' && styles.tabButtonTextActive]}>
              Bài viết
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'achievements' && styles.tabButtonActive]}
            onPress={() => setActiveTab('achievements')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'achievements' && styles.tabButtonTextActive]}>
              Thành tích
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'teams' && styles.tabButtonActive]}
            onPress={() => setActiveTab('teams')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'teams' && styles.tabButtonTextActive]}>
              Đội
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content Area */}
        <View style={styles.tabContentContainer}>
          {activeTab === 'posts' && (
            <View style={styles.emptyStateBox}>
              <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyStateText}>Chưa có bài viết</Text>
            </View>
          )}

          {activeTab === 'achievements' && (
            <View style={styles.emptyStateBox}>
              <Ionicons name="trophy-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyStateText}>Chưa có thành tích</Text>
            </View>
          )}

          {activeTab === 'teams' && (
            <View style={styles.emptyStateBox}>
              <Ionicons name="people-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyStateText}>Chưa gia nhập đội nào</Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalVisible}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chỉnh sửa hồ sơ</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)} hitSlop={10}>
                <Feather name="x" size={20} color="#101828" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
              <Text style={styles.inputLabel}>Tên hiển thị</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nhập tên hiển thị"
                placeholderTextColor="#9ca3af"
                maxLength={30}
              />

              <Text style={styles.inputLabel}>Số điện thoại</Text>
              <TextInput
                style={styles.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Môn thể thao</Text>
              <View style={styles.optionRow}>
                {SPORTS.map((sport) => (
                  <TouchableOpacity
                    key={sport.key}
                    onPress={() => {
                      setEditFavoriteSport(sport.key);
                      const positions = POSITION_OPTIONS[sport.key] || [];
                      setEditPosition(positions[0] || '');
                    }}
                    style={[
                      styles.optionCard,
                      editFavoriteSport === sport.key && styles.optionCardActive,
                    ]}
                  >
                    <Text style={[styles.optionText, editFavoriteSport === sport.key && styles.optionTextActive]}>
                      {sport.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Vị trí chơi</Text>
              <View style={styles.optionRow}>
                {(POSITION_OPTIONS[editFavoriteSport] || []).map((posOption) => (
                  <TouchableOpacity
                    key={posOption}
                    onPress={() => setEditPosition(posOption)}
                    style={[
                      styles.positionCard,
                      editPosition === posOption && styles.positionCardActive,
                    ]}
                  >
                    <Text style={[styles.positionText, editPosition === posOption && styles.positionTextActive]}>
                      {posOption}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Khu vực</Text>
              <TextInput
                style={styles.modalInput}
                value={editArea}
                onChangeText={setEditArea}
                placeholder="Ví dụ: Cầu Giấy, Hà Nội"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.inputLabel}>Mô tả ngắn</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextarea]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Viết vài dòng về bạn"
                placeholderTextColor="#9ca3af"
                multiline
              />

              <Text style={styles.inputLabel}>Email (Không thể thay đổi)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputDisabled]}
                value={user?.email}
                editable={false}
                selectTextOnFocus={false}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveProfile}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {isSaving && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ff5800" />
          <Text style={styles.loadingOverlayText}>Đang lưu thay đổi...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: Platform.OS === 'ios' ? 44 : 56,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerBackBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  headerMoreBtn: {
    padding: 6,
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  avatarWrapper: {
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  defaultAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffebe3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  defaultAvatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ff5800',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#ff5800',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 12,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
    alignSelf: 'center',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  activeStatusText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '700',
  },
  statsGridContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  gridValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  ratingValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStarIcon: {
    marginLeft: 3,
  },
  gridLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
  },
  gridVerticalDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#e2e8f0',
  },
  gridHorizontalDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  highlightsColumnContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 12,
  },
  highlightCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  highlightTextWrap: {
    marginLeft: 14,
    flex: 1,
  },
  highlightIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightEmoji: {
    fontSize: 22,
  },
  highlightTitle: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  highlightValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  tabButton: {
    paddingVertical: 12,
    marginRight: 24,
    position: 'relative',
  },
  tabButtonActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: '#e14f2e',
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabButtonTextActive: {
    color: '#e14f2e',
    fontWeight: '700',
  },
  tabContentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    marginTop: 16,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 12,
  },
  optionCard: {
    minWidth: '30%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  optionCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionText: {
    color: '#1e293b',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  optionTextActive: {
    color: '#2563eb',
  },
  positionCard: {
    minWidth: '32%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  positionCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  positionText: {
    color: '#1e293b',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  positionTextActive: {
    color: '#2563eb',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#fafcff',
  },
  modalInputDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    color: '#64748b',
  },
  modalTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ff5800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingOverlayText: {
    marginTop: 12,
    fontSize: 14,
    color: '#ff5800',
    fontWeight: '600',
  },
});
