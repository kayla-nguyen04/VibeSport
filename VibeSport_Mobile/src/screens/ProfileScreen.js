import { useState, useEffect, useCallback } from 'react';
import { Feather } from '@expo/vector-icons';
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
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getUserProfileRequest } from '../services/userApi';
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

  const openPublicProfile = () => {
    const userId = getUserId(user);
    if (userId) {
      navigation?.navigate('UserProfile', { userId });
    }
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
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

          <View style={styles.followStatsRow}>
            <TouchableOpacity style={styles.followStatItem} onPress={() => openFollowList('following')}>
              <Text style={styles.followStatValue}>{profileStats?.followingCount ?? 0}</Text>
              <Text style={styles.followStatLabel}>Đang theo dõi</Text>
            </TouchableOpacity>
            <View style={styles.followStatDivider} />
            <TouchableOpacity style={styles.followStatItem} onPress={() => openFollowList('followers')}>
              <Text style={styles.followStatValue}>{profileStats?.followerCount ?? 0}</Text>
              <Text style={styles.followStatLabel}>Người theo dõi</Text>
            </TouchableOpacity>
          </View>

          {user?.bio ? (
            <View style={styles.bioBox}>
              <Text style={styles.bioTitle}>Giới thiệu</Text>
              <Text style={styles.bioText}>{user.bio}</Text>
            </View>
          ) : null}

          <View style={styles.profileHighlights}>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Môn thể thao</Text>
              <Text style={styles.profileValue}>{user?.favoriteSport || 'Chưa cập nhật'}</Text>
            </View>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Vị trí</Text>
              <Text style={styles.profileValue}>{user?.position || 'Chưa cập nhật'}</Text>
            </View>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Khu vực</Text>
              <Text style={styles.profileValue}>{user?.area || 'Chưa cập nhật'}</Text>
            </View>
          </View>

          <View style={styles.ratingRow}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Feather
                key={index}
                name="star"
                size={18}
                color={index < (user?.rating ?? 5) ? '#f59e0b' : '#d1d5db'}
              />
            ))}
            <Text style={styles.ratingText}>{((user?.rating ?? 5)).toFixed(1)} / 5.0</Text>
          </View>

        </View>

        <View style={styles.divider} />

        {/* Menu Options Section */}
        <View style={styles.menuContainer}>
          <TouchableOpacity
            onPress={openPublicProfile}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#eef5ff' }]}>
                <Feather name="eye" size={18} color="#0b74ff" />
              </View>
              <Text style={styles.menuText}>Quản lý trang cá nhân</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openFollowList('following')}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#f0fdf4' }]}>
                <Feather name="users" size={18} color="#16a34a" />
              </View>
              <Text style={styles.menuText}>Danh sách theo dõi</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsEditModalVisible(true)}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#ffebe3' }]}>
                <Feather name="user" size={18} color="#ff5800" />
              </View>
              <Text style={styles.menuText}>Chỉnh sửa hồ sơ</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert('Hoạt động', 'Tính năng hiển thị danh sách hoạt động đang được phát triển.')}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#e8f3ff' }]}>
                <Feather name="activity" size={18} color="#0b74ff" />
              </View>
              <Text style={styles.menuText}>Hoạt động</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation?.navigate('SavedPosts')}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#fff7ed' }]}>
                <Feather name="bookmark" size={18} color="#f97316" />
              </View>
              <Text style={styles.menuText}>Bài viết đã lưu</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert('Lịch trình', 'Tính năng lập lịch trình thể thao đang được phát triển.')}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#eafaf1' }]}>
                <Feather name="calendar" size={18} color="#22c55e" />
              </View>
              <Text style={styles.menuText}>Lịch trình</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert('Đội nhóm', 'Tính năng quản lý đội nhóm đang được phát triển.')}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#f5f3ff' }]}>
                <Feather name="users" size={18} color="#8b5cf6" />
              </View>
              <Text style={styles.menuText}>Đội nhóm</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onLogout}
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#fef2f2' }]}>
                <Feather name="log-out" size={18} color="#ef4444" />
              </View>
              <Text style={[styles.menuText, { color: '#ef4444' }]}>Đăng xuất</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#ef4444" />
          </TouchableOpacity>
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
                placeholder="Ví dụ: Đống Đa, Hà Nội"
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
    width: '100%',
    backgroundColor: '#f4f6fb',
  },
  scrollContainer: {
    width: '100%',
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 24,
  },
  avatarWrapper: {
    position: 'relative',
    shadowColor: '#101828',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  defaultAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#ffebe3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  defaultAvatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ff5800',
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#ff5800',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#101828',
    marginTop: 16,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 13,
    color: '#68707f',
    marginTop: 4,
    textAlign: 'center',
  },
  followStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
  },
  followStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  followStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#e2e8f0',
  },
  followStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  followStatLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  profileHighlights: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    width: '100%',
  },
  profileItem: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    marginRight: 10,
  },
  profileLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  ratingText: {
    marginLeft: 10,
    fontSize: 13,
    color: '#475569',
  },
  bioBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
    width: '100%',
  },
  bioTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  bioText: {
    color: '#475569',
    lineHeight: 20,
  },
  featuredBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
  },
  featuredTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  featuredText: {
    color: '#475569',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 24,
    width: '100%',
  },
  menuContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 18,
    shadowColor: '#101828',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
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
