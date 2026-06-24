import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useDispatch, useSelector } from 'react-redux';
import { createPost, updatePost } from '../redux/postSlice';
import { getTagsRequest } from '../services/tagApi';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { API_BASE_URL } from '../components/constants/api';

const MAX_MEDIA = 10;

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

export function CreatePostScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const { creating } = useSelector((state) => state.posts);

  // ── Edit mode ──────────────────────────────────────────────────
  const editPost = route?.params?.editPost ?? null;
  const isEditMode = !!editPost;

  // ── State ──────────────────────────────────────────────────────
  const [content, setContent] = React.useState(editPost?.content ?? '');
  const [catalogTags, setCatalogTags] = React.useState([]);
  const [selectedTag, setSelectedTag] = React.useState(() => {
    if (editPost) {
      const sportTag = editPost.tags?.find((t) => t !== 'Tìm đội');
      return sportTag || editPost.sportType || 'Bóng đá';
    }
    return 'Bóng đá';
  });
  const [showTagDropdown, setShowTagDropdown] = React.useState(false);
  const [location, setLocation] = React.useState(editPost?.location ?? '');
  const [locationLoading, setLocationLoading] = React.useState(false);

  // ── Media state ────────────────────────────────────────────────
  // keptUrls  : ảnh gốc mà user chưa xóa (edit mode)
  // newAssets : ảnh mới user vừa chọn từ thư viện
  const [keptUrls, setKeptUrls] = React.useState(
    isEditMode ? (editPost?.mediaUrls ?? []).map(fixMediaUrl) : []
  );
  const [newAssets, setNewAssets] = React.useState([]);

  // Tổng số ảnh hiện tại
  const totalCount = keptUrls.length + newAssets.length;

  // ── Load tags ──────────────────────────────────────────────────
  React.useEffect(() => {
    getTagsRequest(token)
      .then((res) => setCatalogTags(res.data || []))
      .catch(() => setCatalogTags([]));
  }, [token]);

  const sportTagNames = React.useMemo(
    () => new Set(catalogTags.filter((t) => t.category === 'sport').map((t) => t.name)),
    [catalogTags]
  );
  const sportType = sportTagNames.has(selectedTag) ? selectedTag : editPost?.sportType || 'Bóng đá';

  // ── Pick media ─────────────────────────────────────────────────
  const handlePickMedia = async () => {
    if (totalCount >= MAX_MEDIA) {
      Alert.alert('Giới hạn', `Bạn chỉ có thể có tối đa ${MAX_MEDIA} ảnh/video.`);
      return;
    }
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - totalCount,
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      setNewAssets((prev) => [...prev, ...result.assets.slice(0, MAX_MEDIA - totalCount)]);
    }
  };

  // ── Remove handlers ────────────────────────────────────────────
  const handleRemoveKept = (index) => {
    setKeptUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNew = (index) => {
    setNewAssets((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Location ───────────────────────────────────────────────────
  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập vị trí.');
        return;
      }
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 10000)
      );
      const locResult = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timeoutPromise,
      ]);
      const { latitude, longitude } = locResult.coords;
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode && geocode.length > 0) {
        const addr = geocode[0];
        const street = addr.streetNumber
          ? `${addr.streetNumber} ${addr.street || ''}`
          : addr.street || '';
        const district = addr.district || addr.subregion || '';
        const city = addr.city || addr.region || '';
        const parts = [street, district, city].filter((p) => p.trim() !== '');
        setLocation(parts.join(', ') || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } else {
        setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch (error) {
      if (error.message === 'timeout') {
        Alert.alert('Hết thời gian', 'Không thể lấy vị trí. Bạn có thể đăng bài không có địa điểm.');
      } else {
        Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại.');
      }
    } finally {
      setLocationLoading(false);
    }
  };

  // ── Publish / Update ───────────────────────────────────────────
  const handlePublish = async () => {
    if (!selectedTag) {
      Alert.alert('Chưa chọn tag', 'Vui lòng chọn tag cho bài viết.');
      return;
    }
    if (!content.trim() && totalCount === 0) {
      Alert.alert('Nội dung trống', 'Vui lòng viết gì đó hoặc thêm hình ảnh/video.');
      return;
    }
    if (locationLoading) setLocationLoading(false);

    const originalTags = editPost?.tags || [];
    const finalTags = originalTags.includes('Tìm đội')
      ? ['Tìm đội', selectedTag]
      : [selectedTag];

    const formData = new FormData();
    formData.append('content', content.trim());
    formData.append('location', location);
    formData.append('sportType', sportType);
    formData.append('tags', JSON.stringify(finalTags));

    // Gửi danh sách URL gốc muốn GIỮ LẠI (server sẽ xóa các URL không có trong này)
    if (isEditMode) {
      // Gửi URL gốc (trước khi fixMediaUrl) để server có thể so khớp
      const originalKeptUrls = keptUrls.map((url) =>
        // Đảo ngược fixMediaUrl: khôi phục URL gốc từ server
        url.replace(API_BASE_URL, API_BASE_URL) // URL đã là tuyệt đối, giữ nguyên
      );
      formData.append('keepMediaUrls', JSON.stringify(originalKeptUrls));
    }

    // Append ảnh mới
    newAssets.forEach((asset, index) => {
      const uri = asset.uri;
      const uriParts = uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      const fileName = uri.split('/').pop();
      formData.append('media', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: fileName || `media-${index}.${fileType}`,
        type: asset.type === 'video' ? `video/${fileType}` : `image/${fileType}`,
      });
    });

    if (isEditMode) {
      dispatch(updatePost({ postId: editPost._id, formData }))
        .unwrap()
        .then(() => {
          Alert.alert('Thành công', 'Đã cập nhật bài viết!', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        })
        .catch((err) => {
          Alert.alert('Thất bại', err || 'Đã xảy ra lỗi khi cập nhật bài.');
        });
    } else {
      dispatch(createPost(formData))
        .unwrap()
        .then(() => {
          Alert.alert('Thành công', 'Đăng bài viết lên cộng đồng thành công!', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        })
        .catch((err) => {
          Alert.alert('Thất bại', err || 'Đã xảy ra lỗi khi đăng bài.');
        });
    }
  };

  const isPublishDisabled = creating || (!content.trim() && totalCount === 0);

  // ── Render media grid ──────────────────────────────────────────
  const renderMediaGrid = () => {
    const items = [];

    // 1) Ảnh gốc còn lại (keptUrls) — có nút X để xóa
    keptUrls.forEach((url, i) => {
      items.push(
        <View key={`kept-${i}`} style={styles.mediaCell}>
          <Image source={{ uri: url }} style={styles.mediaCellImage} resizeMode="cover" />
          <TouchableOpacity
            style={styles.removeCellBtn}
            onPress={() => handleRemoveKept(i)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      );
    });

    // 2) Ảnh mới vừa chọn — có nút X để xóa
    newAssets.forEach((asset, i) => {
      items.push(
        <View key={`new-${i}`} style={styles.mediaCell}>
          <Image source={{ uri: asset.uri }} style={styles.mediaCellImage} resizeMode="cover" />
          <TouchableOpacity
            style={styles.removeCellBtn}
            onPress={() => handleRemoveNew(i)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </TouchableOpacity>
          {asset.type === 'video' && (
            <View style={styles.videoBadge}>
              <Ionicons name="play" size={12} color="#FFFFFF" />
            </View>
          )}
        </View>
      );
    });

    // 3) Nút "+" thêm ảnh (nếu chưa đủ 10)
    if (totalCount < MAX_MEDIA) {
      items.push(
        <TouchableOpacity
          key="add-btn"
          style={styles.addCell}
          onPress={handlePickMedia}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={30} color="#FF6B35" />
        </TouchableOpacity>
      );
    }

    if (items.length === 0) return null;

    return <View style={styles.mediaGrid}>{items}</View>;
  };

  // ── JSX ────────────────────────────────────────────────────────
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
        <Text style={styles.headerTitle}>{isEditMode ? 'Sửa bài viết' : 'Tạo bài viết'}</Text>
        <TouchableOpacity
          onPress={handlePublish}
          disabled={isPublishDisabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.publishBtn, isPublishDisabled && styles.publishBtnDisabled]}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.publishBtnText}>{isEditMode ? 'Lưu' : 'Đăng'}</Text>
          )}
        </TouchableOpacity>
      </ScreenHeader>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* ── User info ── */}
          <View style={styles.userRow}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(user?.name) }]}>
                <Text style={styles.avatarPlaceholderText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Thành viên VibeSport'}</Text>
              <TouchableOpacity
                onPress={() => setShowTagDropdown(!showTagDropdown)}
                style={styles.tagDropdownTrigger}
              >
                <Text style={styles.tagDropdownText}>{selectedTag || 'Chọn tag'}</Text>
                <Ionicons name="chevron-down" size={14} color="#FF6B35" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Tag dropdown ── */}
          {showTagDropdown && (
            <View style={styles.dropdownOptions}>
              {(catalogTags.length
                ? catalogTags.filter((t) => ['Bóng đá', 'Cầu lông', 'Pickleball'].includes(t.name))
                : [{ name: 'Bóng đá' }, { name: 'Cầu lông' }, { name: 'Pickleball' }]
              ).map((tag) => (
                <TouchableOpacity
                  key={tag._id || tag.name}
                  onPress={() => { setSelectedTag(tag.name); setShowTagDropdown(false); }}
                  style={[styles.dropdownItem, selectedTag === tag.name && styles.dropdownItemActive]}
                >
                  <Text style={[styles.dropdownItemText, selectedTag === tag.name && styles.dropdownItemTextActive]}>
                    {tag.name}
                  </Text>
                  {selectedTag === tag.name && <Ionicons name="checkmark" size={16} color="#FF6B35" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Text input ── */}
          <TextInput
            multiline
            placeholder="Chia sẻ niềm đam mê thể thao của bạn tại đây..."
            placeholderTextColor="#9CA3AF"
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            maxLength={3000}
          />
          <Text style={[styles.charCounter, content.length > 2700 && styles.charCounterWarn]}>
            {content.length}/3000 ký tự
          </Text>

          {/* ── Media grid (ảnh cũ + ảnh mới + nút +) ── */}
          {renderMediaGrid()}

          {/* Nút "Thêm ảnh / video" full-width (khi chưa có ảnh nào) */}
          {totalCount === 0 && (
            <TouchableOpacity onPress={handlePickMedia} style={styles.addMediaBtn}>
              <Ionicons name="image-outline" size={24} color="#FF6B35" />
              <Text style={styles.addMediaText}>Thêm ảnh / video</Text>
            </TouchableOpacity>
          )}

          {/* ── Location ── */}
          {location ? (
            <View style={[styles.locationBlock, styles.locationBlockActive]}>
              <Ionicons name="location" size={20} color="#10B981" />
              <Text style={[styles.locationAddressText, styles.locationAddressTextActive]} numberOfLines={2}>
                {location}
              </Text>
              <TouchableOpacity onPress={() => setLocation('')} style={styles.locationRemoveBtn}>
                <Ionicons name="close-circle" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleGetLocation}
              disabled={locationLoading}
              style={styles.locationBlock}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#FF6B35" />
              ) : (
                <Ionicons name="location-outline" size={20} color="#6B7280" />
              )}
              <Text style={styles.locationAddressText}>
                {locationLoading ? 'Đang lấy vị trí của bạn...' : 'Thêm địa điểm vào bài viết'}
              </Text>
              {!locationLoading && <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />}
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const CELL_SIZE = '31%';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  publishBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnDisabled: { backgroundColor: '#FFBEA3' },
  publishBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },

  scrollContent: { paddingBottom: 40 },

  // ── User row ──
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E5E7EB' },
  avatarPlaceholder: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  userInfo: { marginLeft: 12, flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  tagDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  tagDropdownText: { color: '#FF6B35', fontSize: 12, fontWeight: 'bold' },

  // ── Dropdown ──
  dropdownOptions: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemActive: { backgroundColor: '#FFF0EA' },
  dropdownItemText: { color: '#374151', fontSize: 14 },
  dropdownItemTextActive: { color: '#FF6B35', fontWeight: 'bold' },

  // ── Text input ──
  contentInput: {
    minHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 16,
    color: '#1F2937',
    textAlignVertical: 'top',
  },
  charCounter: { alignSelf: 'flex-end', fontSize: 12, color: '#9CA3AF', marginRight: 16, marginBottom: 8 },
  charCounterWarn: { color: '#EF4444' },

  // ── Media grid ──
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  // Ô ảnh (có ảnh)
  mediaCell: {
    position: 'relative',
    width: CELL_SIZE,
    aspectRatio: 1,
  },
  mediaCellImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  removeCellBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ô "+" thêm ảnh
  addCell: {
    width: CELL_SIZE,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFD9CC',
    borderStyle: 'dashed',
    backgroundColor: '#FFF5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Nút thêm ảnh full-width (khi chưa có ảnh)
  addMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD9CC',
    borderStyle: 'dashed',
    backgroundColor: '#FFF5F2',
    gap: 8,
  },
  addMediaText: { color: '#FF6B35', fontWeight: 'bold', fontSize: 14 },

  // ── Location ──
  locationBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 12,
  },
  locationBlockActive: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  locationAddressText: { flex: 1, color: '#6B7280', fontSize: 14 },
  locationAddressTextActive: { color: '#10B981', fontWeight: '500' },
  locationRemoveBtn: { padding: 2 },
});
