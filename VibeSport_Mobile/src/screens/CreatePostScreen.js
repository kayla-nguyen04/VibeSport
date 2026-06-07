import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
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
import { createPost } from '../redux/postSlice';

const SPORTS = ['Bóng đá', 'Bóng rổ', 'Cầu lông', 'Bóng chuyền', 'Bóng bàn', 'Tennis', 'Chạy bộ'];

export function CreatePostScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { creating } = useSelector((state) => state.posts);

  const [content, setContent] = useState('');
  const [selectedSport, setSelectedSport] = useState('Bóng đá');
  const [showSportDropdown, setShowSportDropdown] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState([]); // Array of picked assets
  
  // Location states
  const [location, setLocation] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  const handlePickMedia = async () => {
    if (selectedMedia.length >= 10) {
      Alert.alert('Giới hạn', 'Bạn chỉ có thể chọn tối đa 10 ảnh/video.');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh để tải phương tiện lên.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 10 - selectedMedia.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setSelectedMedia((prev) => [...prev, ...result.assets.slice(0, 10 - prev.length)]);
    }
  };

  const handleRemoveMedia = (index) => {
    setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  // Get current location using GPS and reverse-geocode to address
  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập vị trí để gắn địa điểm.');
        setLocationLoading(false);
        return;
      }

      const locResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = locResult.coords;

      // Reverse geocode
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode && geocode.length > 0) {
        const addr = geocode[0];
        // Construct standard Vietnamese address string: e.g. "123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh"
        const street = addr.streetNumber ? `${addr.streetNumber} ${addr.street || ''}` : (addr.street || '');
        const district = addr.district || addr.subregion || '';
        const city = addr.city || addr.region || '';
        
        const addressParts = [street, district, city].filter(p => p.trim() !== '');
        const fullAddress = addressParts.join(', ');
        
        setLocation(fullAddress || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } else {
        setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại của bạn.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleRemoveLocation = () => {
    setLocation('');
  };

  const handlePublish = async () => {
    if (!content.trim() && selectedMedia.length === 0) {
      Alert.alert('Nội dung trống', 'Vui lòng viết gì đó hoặc thêm hình ảnh/video.');
      return;
    }

    const formData = new FormData();
    formData.append('content', content.trim());
    formData.append('location', location);
    formData.append('sportType', selectedSport);

    selectedMedia.forEach((asset, index) => {
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

    dispatch(createPost(formData))
      .unwrap()
      .then(() => {
        Alert.alert('Thành công', 'Đăng bài viết lên cộng đồng thành công!', [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]);
      })
      .catch((err) => {
        Alert.alert('Thất bại', err || 'Đã xảy ra lỗi khi đăng bài.');
      });
  };

  const isPublishDisabled = creating || (!content.trim() && selectedMedia.length === 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tạo bài viết</Text>
          <TouchableOpacity
            onPress={handlePublish}
            disabled={isPublishDisabled}
            style={[styles.publishBtn, isPublishDisabled && styles.publishBtnDisabled]}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.publishBtnText}>Đăng</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* User Profile Info */}
          <View style={styles.userRow}>
            <Image
              source={
                user?.picture
                  ? { uri: user.picture }
                  : { uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }
              }
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Thành viên VibeSport'}</Text>
              
              {/* Sport Selector Dropdown Trigger */}
              <TouchableOpacity
                onPress={() => setShowSportDropdown(!showSportDropdown)}
                style={styles.sportDropdownTrigger}
              >
                <Text style={styles.sportDropdownText}>{selectedSport}</Text>
                <Ionicons name="chevron-down" size={14} color="#FF6B35" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sport Dropdown Options */}
          {showSportDropdown && (
            <View style={styles.dropdownOptions}>
              {SPORTS.map((sport) => (
                <TouchableOpacity
                  key={sport}
                  onPress={() => {
                    setSelectedSport(sport);
                    setShowSportDropdown(false);
                  }}
                  style={[
                    styles.dropdownItem,
                    selectedSport === sport && styles.dropdownItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedSport === sport && styles.dropdownItemTextActive,
                    ]}
                  >
                    {sport}
                  </Text>
                  {selectedSport === sport && (
                    <Ionicons name="checkmark" size={16} color="#FF6B35" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Text Input */}
          <TextInput
            multiline
            placeholder="Chia sẻ niềm đam mê thể thao của bạn tại đây..."
            placeholderTextColor="#9CA3AF"
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            maxLength={3000}
          />
          <Text style={styles.charCounter}>{content.length}/3000 ký tự</Text>

          {/* Media Previews */}
          {selectedMedia.length > 0 && (
            <View style={styles.mediaGrid}>
              {selectedMedia.map((asset, index) => (
                <View key={index} style={styles.mediaPreviewContainer}>
                  <Image source={{ uri: asset.uri }} style={styles.mediaPreview} />
                  <TouchableOpacity
                    onPress={() => handleRemoveMedia(index)}
                    style={styles.removeMediaBtn}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  {asset.type === 'video' && (
                    <View style={styles.videoBadge}>
                      <Ionicons name="play" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Location Block */}
          {location ? (
            <View style={[styles.locationBlock, styles.locationBlockActive]}>
              <Ionicons name="location" size={20} color="#10B981" />
              <Text style={[styles.locationAddressText, styles.locationAddressTextActive]}>
                {location}
              </Text>
              <TouchableOpacity onPress={handleRemoveLocation} style={styles.locationRemoveBtn}>
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

          {/* Add Media Button */}
          <TouchableOpacity onPress={handlePickMedia} style={styles.addMediaBtn}>
            <Ionicons name="image-outline" size={24} color="#FF6B35" />
            <Text style={styles.addMediaText}>Thêm ảnh / video</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  publishBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnDisabled: {
    backgroundColor: '#FFBEA3',
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E7EB',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sportDropdownTrigger: {
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
  sportDropdownText: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: 'bold',
  },
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
  dropdownItemActive: {
    backgroundColor: '#FFF0EA',
  },
  dropdownItemText: {
    color: '#374151',
    fontSize: 14,
  },
  dropdownItemTextActive: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  contentInput: {
    minHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 16,
    color: '#1F2937',
    textAlignVertical: 'top',
  },
  charCounter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: '#9CA3AF',
    marginRight: 16,
    marginBottom: 16,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  mediaPreviewContainer: {
    position: 'relative',
    width: '31%',
    aspectRatio: 1,
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  locationBlockActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  locationAddressText: {
    flex: 1,
    color: '#6B7280',
    fontSize: 14,
  },
  locationAddressTextActive: {
    color: '#10B981',
    fontWeight: '500',
  },
  locationRemoveBtn: {
    padding: 2,
  },
  addMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD9CC',
    borderStyle: 'dashed',
    backgroundColor: '#FFF5F2',
    gap: 8,
  },
  addMediaText: {
    color: '#FF6B35',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
