import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Share,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../components/constants/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = 190;

const SPORTS = ['Bóng đá', 'Cầu lông', 'Pickleball'];

const fixMediaUrl = (url) => {
  if (!url) return '';
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
};

export default function FCScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const token = useSelector((state) => state.auth?.token);
  const user = useSelector((state) => state.auth?.user);

  // Navigation / View modes: 'search', 'create', 'detail'
  const [viewMode, setViewMode] = useState('search');
  const [loading, setLoading] = useState(false);

  // Search view state
  const [searchQuery, setSearchQuery] = useState('');
  const [fcs, setFcs] = useState([]);

  // Create FC form state
  const [fcName, setFcName] = useState('');
  const [fcDesc, setFcDesc] = useState('');
  const [sportType, setSportType] = useState('Bóng đá');
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarAsset, setAvatarAsset] = useState(null);
  const [coverAsset, setCoverAsset] = useState(null);
  const [isEditingFC, setIsEditingFC] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  // Detail view state
  const [selectedFcId, setSelectedFcId] = useState(null);
  const [selectedFcData, setSelectedFcData] = useState(null); // { fc, posts, isMember, membersCount }
  const [detailLoading, setDetailLoading] = useState(false);

  // Post inside FC state
  const [showPostBox, setShowPostBox] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postAssets, setPostAssets] = useState([]);
  const [postLoading, setPostLoading] = useState(false);

  // Load FC list
  const loadFCs = useCallback(async (query = '') => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/fc/search?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        setFcs(json.data || []);
      } else {
        Alert.alert('Lỗi', json.message || 'Không thể tải danh sách FC');
      }
    } catch (err) {
      console.error('Load FC error:', err);
      Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load on mount and focus
  useFocusEffect(
    useCallback(() => {
      if (viewMode === 'search') {
        loadFCs(searchQuery);
      } else if (viewMode === 'detail' && selectedFcId) {
        loadFCDetails(selectedFcId);
      }
    }, [viewMode, selectedFcId, loadFCs])
  );

  // Load FC details
  const loadFCDetails = async (fcId) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/fc/${fcId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        setSelectedFcData(json.data);
      } else {
        Alert.alert('Lỗi', json.message || 'Không thể tải chi tiết FC');
        setViewMode('search');
      }
    } catch (err) {
      console.error('Load FC details error:', err);
      Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
      setViewMode('search');
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle join / leave
  const handleJoinLeaveFC = async () => {
    if (!selectedFcData) return;
    const { isMember, hasPendingRequest } = selectedFcData;
    if (isMember) {
      try {
        setDetailLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/fc/${selectedFcId}/leave`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        if (json.success) {
          Alert.alert('Thành công', json.message);
          loadFCDetails(selectedFcId);
        } else {
          Alert.alert('Lỗi', json.message || 'Không thể thực hiện yêu cầu');
        }
      } catch (err) {
        console.error('Leave FC error:', err);
        Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
      } finally {
        setDetailLoading(false);
      }
      return;
    }

    if (hasPendingRequest) {
      Alert.alert('Đã gửi yêu cầu', 'Bạn đã gửi yêu cầu tham gia FC riêng tư. Vui lòng chờ chủ FC chấp nhận.');
      return;
    }

    try {
      setDetailLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/fc/${selectedFcId}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        Alert.alert('Thành công', json.message);
        loadFCDetails(selectedFcId);
      } else {
        Alert.alert('Lỗi', json.message || 'Không thể thực hiện yêu cầu');
      }
    } catch (err) {
      console.error('Join FC error:', err);
      Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
    } finally {
      setDetailLoading(false);
    }
  };

  // Pick FC Logo
  const handlePickFCLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAvatarAsset(result.assets[0]);
    }
  };

  // Pick FC Cover Image
  const handlePickFCCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setCoverAsset(result.assets[0]);
    }
  };

  // Create FC / Update FC
  const handleCreateFC = async () => {
    if (!fcName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên FC');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('name', fcName.trim());
      formData.append('description', fcDesc.trim());
      formData.append('sportType', sportType);
      formData.append('isPrivate', isPrivate ? 'true' : 'false');

      if (avatarAsset) {
        const uri = avatarAsset.uri;
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('avatar', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: filename || 'avatar.jpg',
          type,
        });
      }

      if (coverAsset) {
        const uri = coverAsset.uri;
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('coverImage', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: filename || 'cover.jpg',
          type,
        });
      }

      const url = isEditingFC 
        ? `${API_BASE_URL}/api/fc/${selectedFcId}`
        : `${API_BASE_URL}/api/fc`;
      
      const method = isEditingFC ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        Alert.alert('Thành công', isEditingFC ? 'Cập nhật FC thành công!' : 'Tạo FC thành công!');
        // Reset form
        setFcName('');
        setFcDesc('');
        setAvatarAsset(null);
        setCoverAsset(null);
        setIsPrivate(false);
        setIsEditingFC(false);

        if (isEditingFC) {
          setViewMode('detail');
          loadFCDetails(selectedFcId);
        } else {
          setViewMode('search');
          loadFCs('');
        }
      } else {
        Alert.alert('Lỗi', json.message || 'Không thể thực hiện tác vụ');
      }
    } catch (err) {
      console.error('FC submit error:', err);
      Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Actions menu for FC details screen
  const handleFCActionMenu = () => {
    if (!selectedFcData || !selectedFcData.fc) return;
    const { fc, isOwner } = selectedFcData;

    if (isOwner) {
      Alert.alert(
        `Quản lý FC: ${fc.name}`,
        'Chọn một tác vụ quản trị dưới đây:',
        [
          {
            text: 'Chỉnh sửa thông tin FC',
            onPress: () => {
              setFcName(fc.name || '');
              setFcDesc(fc.description || '');
              setSportType(fc.sportType || 'Bóng đá');
              setIsPrivate(fc.isPrivate || false);
              setIsEditingFC(true);
              setViewMode('create');
            },
          },
          {
            text: 'Xóa FC',
            style: 'destructive',
            onPress: () => confirmDeleteFC(fc._id),
          },
          {
            text: 'Đóng',
            style: 'cancel',
          },
        ]
      );
    } else {
      Alert.alert(
        `Tương tác với FC: ${fc.name}`,
        'Chọn tác vụ:',
        [
          {
            text: 'Báo cáo FC',
            onPress: () => handleReportFC(fc._id, fc.name),
          },
          {
            text: 'Chia sẻ FC',
            onPress: () => handleShareFC(fc._id, fc.name),
          },
          {
            text: 'Đóng',
            style: 'cancel',
          },
        ]
      );
    }
  };

  // Confirm delete FC
  const confirmDeleteFC = (fcId) => {
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc chắn muốn xóa Fan Club này? Hành động này sẽ xóa vĩnh viễn FC và tất cả bài viết bên trong.',
      [
        { text: 'Hủy', style: 'cancel' },
         {
           text: 'Xóa',
           style: 'destructive',
           onPress: async () => {
             try {
               setDetailLoading(true);
               const res = await fetch(`${API_BASE_URL}/api/fc/${fcId}`, {
                 method: 'DELETE',
                 headers: {
                   Authorization: `Bearer ${token}`,
                 },
               });
               const json = await res.json();
               if (json.success) {
                 Alert.alert('Thành công', 'Đã xóa FC thành công!');
                 setViewMode('search');
                 loadFCs('');
               } else {
                 Alert.alert('Lỗi', json.message || 'Không thể xóa FC');
               }
             } catch (err) {
               console.error('Delete FC error:', err);
               Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
             } finally {
               setDetailLoading(false);
             }
           },
         },
      ]
    );
  };

  // Report FC
  const handleReportFC = (fcId, fcName) => {
    Alert.alert(
      'Báo cáo FC',
      `Bạn có muốn báo cáo nội dung vi phạm của Fan Club "${fcName}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Báo cáo',
          onPress: () => {
            Alert.alert('Thành công', 'Cảm ơn đóng góp của bạn. Chúng tôi đã nhận được báo cáo và sẽ kiểm duyệt FC này sớm nhất.');
          },
        },
      ]
    );
  };

  // Share FC
  const handleShareFC = async (fcId, fcName) => {
    try {
      await Share.share({
        message: `Hãy tham gia Fan Club "${fcName}" trên ứng dụng VibeSport nhé!`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // Get sorted members list: owner first, then members sorted by joined date (createdAt)
  const getSortedMembers = (fcData) => {
    if (!fcData || !fcData.fc || !fcData.fc.members) return [];
    const createdById = fcData.fc.createdBy?._id || fcData.fc.createdBy;
    const membersList = [...fcData.fc.members];
    
    return membersList.sort((a, b) => {
      const aIsOwner = String(a._id) === String(createdById);
      const bIsOwner = String(b._id) === String(createdById);
      
      if (aIsOwner) return -1;
      if (bIsOwner) return 1;
      
      const aDate = new Date(a.createdAt || 0);
      const bDate = new Date(b.createdAt || 0);
      return aDate - bDate;
    });
  };

  // Actions menu for posts inside FC
  const handlePostMoreOptions = (post) => {
    const isPostOwner = post.userId?._id === user?._id || post.userId === user?._id;
    
    if (isPostOwner) {
      Alert.alert(
        'Tùy chọn bài viết',
        'Chọn hành động bạn muốn thực hiện:',
        [
          {
            text: 'Sửa bài viết',
            onPress: () => navigation.navigate('CreatePost', { editPost: post }),
          },
          {
            text: 'Xóa bài viết',
            style: 'destructive',
            onPress: () => handleDeletePost(post._id),
          },
          {
            text: 'Hủy',
            style: 'cancel',
          },
        ]
      );
    } else {
      Alert.alert(
        'Tương tác với bài viết',
        'Chọn hành động:',
        [
          {
            text: 'Báo cáo bài viết',
            onPress: () => {
              Alert.alert('Thành công', 'Cảm ơn bạn đã báo cáo. Chúng tôi sẽ xem xét bài viết này sớm nhất có thể!');
            },
          },
          {
            text: 'Hủy',
            style: 'cancel',
          },
        ]
      );
    }
  };

  // Delete a post inside FC
  const handleDeletePost = (postId) => {
    Alert.alert('Xóa bài viết', 'Bạn có chắc chắn muốn xóa bài viết này không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            setDetailLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            const json = await res.json();
            if (json.success) {
              Alert.alert('Thành công', 'Đã xóa bài viết.');
              loadFCDetails(selectedFcId);
            } else {
              Alert.alert('Lỗi', json.message || 'Không thể xóa bài viết');
            }
          } catch (err) {
            console.error('Delete post error:', err);
            Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
          } finally {
            setDetailLoading(false);
          }
        },
      },
    ]);
  };

  // Pick post images
  const handlePickPostImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      setPostAssets((prev) => [...prev, ...result.assets]);
    }
  };

  // Create post inside FC
  const handleCreatePost = async () => {
    if (!postContent.trim() && postAssets.length === 0) {
      Alert.alert('Nội dung trống', 'Vui lòng nhập nội dung bài viết hoặc chọn ảnh');
      return;
    }

    try {
      setPostLoading(true);
      const formData = new FormData();
      formData.append('content', postContent.trim());
      formData.append('fcId', selectedFcId);
      formData.append('sportType', selectedFcData?.fc?.sportType || 'Bóng đá');
      formData.append('tags', JSON.stringify([]));

      postAssets.forEach((asset, index) => {
        const uri = asset.uri;
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('media', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: filename || `media-${index}.jpg`,
          type,
        });
      });

      const res = await fetch(`${API_BASE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        Alert.alert('Thành công', 'Đăng bài viết thành công!');
        setPostContent('');
        setPostAssets([]);
        setShowPostBox(false);
        loadFCDetails(selectedFcId);
      } else {
        Alert.alert('Lỗi', json.message || 'Không thể đăng bài viết');
      }
    } catch (err) {
      console.error('Create post inside FC error:', err);
      Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
    } finally {
      setPostLoading(false);
    }
  };

  // Helper formatting time
  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  };

  // ────────── RENDER SEARCH VIEW ──────────
  if (viewMode === 'search') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={{ paddingTop: insets.top }}>
          <View style={styles.appHeader}>
            <View style={styles.appHeaderLeft}>
              <Image
                source={require('../../assets/logosp.png')}
                style={styles.appLogo}
                resizeMode="contain"
              />
              <Text style={styles.appTitle}>
                <Text style={styles.appTitleVibe}>Tìm kiếm </Text>
                <Text style={styles.appTitleSport}>FC</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.createFCBtn}
              activeOpacity={0.7}
              onPress={() => setViewMode('create')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.createFCBtnText}>Tạo FC</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search input */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color="#6b7280" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Nhập tên FC muốn tìm..."
              value={searchQuery}
              onChangeText={(txt) => {
                setSearchQuery(txt);
                loadFCs(txt);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); loadFCs(''); }}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : fcs.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.noDataText}>Không tìm thấy FC nào</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 30 }}>
            {fcs.map((fc) => {
              const firstLetter = getInitials(fc.name);
              return (
                <TouchableOpacity
                  key={fc._id}
                  style={styles.fcListItem}
                  activeOpacity={0.9}
                  onPress={() => {
                    setSelectedFcId(fc._id);
                    setViewMode('detail');
                  }}
                >
                  {fc.avatar ? (
                    <Image source={{ uri: fixMediaUrl(fc.avatar) }} style={styles.fcItemAvatar} />
                  ) : (
                    <View style={[styles.fcItemAvatarPlaceholder, { backgroundColor: '#f97316' }]}>
                      <Text style={styles.fcItemAvatarPlaceholderText}>{firstLetter}</Text>
                    </View>
                  )}
                  <View style={styles.fcItemInfo}>
                    <Text style={styles.fcItemName}>{fc.name}</Text>
                    <Text style={styles.fcItemDesc} numberOfLines={2}>
                      {fc.description || 'Chưa có mô tả cho FC này.'}
                    </Text>
                    <View style={styles.fcItemBadges}>
                      <View style={styles.fcItemBadge}>
                        <Text style={styles.fcItemBadgeText}>
                          👥 {fc.members ? fc.members.length : 1} thành viên
                        </Text>
                      </View>
                      <View style={[styles.fcItemBadge, { backgroundColor: '#fff3ef' }]}>
                        <Text style={[styles.fcItemBadgeText, { color: '#f97316' }]}>
                          {fc.sportType || 'Bóng đá'}
                        </Text>
                      </View>
                      <View style={[styles.fcItemBadge, { backgroundColor: fc.isPrivate ? '#fee2e2' : '#dcfce7' }]}>
                        <Text style={[styles.fcItemBadgeText, { color: fc.isPrivate ? '#ef4444' : '#22c55e' }]}>
                          {fc.isPrivate ? '🔒 Riêng tư' : '🌍 Công khai'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  // ────────── RENDER CREATE VIEW ──────────
  if (viewMode === 'create') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={{ paddingTop: insets.top }}>
          <View style={styles.appHeader}>
            <TouchableOpacity 
              onPress={() => {
                if (isEditingFC) {
                  setFcName('');
                  setFcDesc('');
                  setAvatarAsset(null);
                  setCoverAsset(null);
                  setIsPrivate(false);
                  setIsEditingFC(false);
                  setViewMode('detail');
                } else {
                  setViewMode('search');
                }
              }} 
              style={styles.headerBackBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.appTitle}>{isEditingFC ? 'Chỉnh sửa Fan Club' : 'Tạo Fan Club (FC)'}</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.formLabel}>Tên FC <Text style={{ color: 'red' }}>*</Text></Text>
          <TextInput
            style={styles.formInput}
            placeholder="Nhập tên FC của bạn..."
            value={fcName}
            onChangeText={setFcName}
          />

          <Text style={styles.formLabel}>Ảnh đại diện FC</Text>
          <View style={styles.avatarPickerRow}>
            <TouchableOpacity style={styles.avatarPickerBox} onPress={handlePickFCLogo} activeOpacity={0.7}>
              {avatarAsset ? (
                <Image source={{ uri: avatarAsset.uri }} style={styles.avatarPreview} />
              ) : (
                <View style={styles.avatarPickerPlaceholder}>
                  <Ionicons name="camera-outline" size={30} color="#888" />
                  <Text style={styles.avatarPickerHelper}>Chọn ảnh</Text>
                </View>
              )}
            </TouchableOpacity>
            {avatarAsset && (
              <TouchableOpacity
                style={styles.removeAvatarBtn}
                onPress={() => setAvatarAsset(null)}
              >
                <Text style={styles.removeAvatarBtnText}>Xóa ảnh</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.formLabel}>Ảnh nền FC (Ảnh bìa)</Text>
          <View style={styles.avatarPickerRow}>
            <TouchableOpacity 
              style={[styles.avatarPickerBox, { width: 140, height: 80, borderRadius: 8 }]} 
              onPress={handlePickFCCover} 
              activeOpacity={0.7}
            >
              {coverAsset ? (
                <Image source={{ uri: coverAsset.uri }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
              ) : (
                <View style={styles.avatarPickerPlaceholder}>
                  <Ionicons name="image-outline" size={30} color="#888" />
                  <Text style={styles.avatarPickerHelper}>Chọn ảnh nền</Text>
                </View>
              )}
            </TouchableOpacity>
            {coverAsset && (
              <TouchableOpacity
                style={styles.removeAvatarBtn}
                onPress={() => setCoverAsset(null)}
              >
                <Text style={styles.removeAvatarBtnText}>Xóa ảnh</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.formLabel}>Môn thể thao</Text>
          <View style={styles.sportOptionRow}>
            {SPORTS.map((sport) => (
              <TouchableOpacity
                key={sport}
                style={[
                  styles.sportOption,
                  sportType === sport && styles.sportOptionActive,
                ]}
                activeOpacity={0.8}
                onPress={() => setSportType(sport)}
              >
                <Text style={[
                  styles.sportOptionText,
                  sportType === sport && styles.sportOptionTextActive,
                ]}>
                  {sport}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Mô tả FC</Text>
          <TextInput
            style={[styles.formInput, { height: 100, textAlignVertical: 'top' }]}
            placeholder="Viết lời giới thiệu về FC..."
            value={fcDesc}
            onChangeText={setFcDesc}
            multiline
          />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>
                {isPrivate ? '🔒 FC Riêng tư' : '🌍 FC Công khai'}
              </Text>
              <Text style={styles.toggleHelper}>
                {isPrivate
                  ? 'Chỉ thành viên mới xem được bài viết. Muốn tham gia cần chủ FC chấp nhận.'
                  : 'Mọi người đều xem được bài viết và tự do tham gia / rời FC.'}
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: '#767577', true: '#f97316' }}
              thumbColor={isPrivate ? '#fff' : '#f4f3f4'}
            />
          </View>

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleCreateFC}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{isEditingFC ? 'Lưu thay đổi' : 'Tạo FC ngay'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ────────── RENDER DETAIL VIEW ──────────
  if (viewMode === 'detail' && selectedFcData) {
    const { fc, posts, isMember, membersCount } = selectedFcData;
    const firstLetter = getInitials(fc.name);

    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={{ paddingTop: insets.top }}>
          <View style={styles.appHeader}>
            <TouchableOpacity onPress={() => setViewMode('search')} style={styles.headerBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.appTitle} numberOfLines={1}>FC {fc.name}</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Banner */}
          <View style={styles.bannerContainer}>
            <Image
              source={fc.coverImage ? { uri: fixMediaUrl(fc.coverImage) } : require('../../assets/fc_banner.png')}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <View style={styles.bannerOverlay} />
          </View>

          {/* Club Header Card */}
          <View style={styles.clubHeaderCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.clubLogoWrap}>
                {fc.avatar ? (
                  <Image
                    source={{ uri: fixMediaUrl(fc.avatar) }}
                    style={styles.clubLogo}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.clubLogoPlaceholder, { backgroundColor: '#f97316' }]}>
                    <Text style={styles.clubLogoPlaceholderText}>{firstLetter}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.clubName, { marginLeft: 16, flex: 1, marginTop: 0 }]} numberOfLines={1}>
                {fc.name}
              </Text>
            </View>
            <TouchableOpacity style={{ padding: 8 }} activeOpacity={0.7} onPress={handleFCActionMenu}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Club Details Card */}
          <View style={styles.clubDetailsCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nhóm: </Text>
              <Text style={styles.infoValue}>{fc.isPrivate ? 'Riêng tư' : 'Công khai'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Môn thể thao: </Text>
              <Text style={styles.infoValue}>{fc.sportType || 'Bóng đá'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Thành viên: </Text>
              <Text style={styles.infoValue}>{membersCount} thành viên</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bài viết: </Text>
              <Text style={styles.infoValue}>{posts?.length || 0} bài viết</Text>
            </View>

            {/* Overlapping Member Avatars */}
            {fc.members && fc.members.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12, paddingLeft: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {fc.members.slice(0, 3).map((m, idx) => {
                    const memberInitials = m.name ? m.name.charAt(0).toUpperCase() : '?';
                    return (
                      <View
                        key={m._id || idx}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          borderWidth: 2,
                          borderColor: '#FFFFFF',
                          marginLeft: idx > 0 ? -10 : 0,
                          backgroundColor: '#EF4444',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 2,
                          elevation: 2,
                        }}
                      >
                        {m.picture ? (
                          <Image source={{ uri: m.picture }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>{memberInitials}</Text>
                        )}
                      </View>
                    );
                  })}
                  {fc.members.length > 3 && (
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#E5E7EB',
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
                        marginLeft: -10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2,
                      }}
                    >
                      <Text style={{ color: '#4B5563', fontSize: 11, fontWeight: 'bold' }}>+{fc.members.length - 3}</Text>
                    </View>
                  )}
                </View>

                {/* View All Members Button */}
                <TouchableOpacity 
                  style={{
                    backgroundColor: '#FFF0EA',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#FFD8CC'
                  }}
                  onPress={() => setShowMembersModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: '#FF6B35', fontSize: 12.5, fontWeight: '700' }}>Xem danh sách</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.joinBtn,
                (isMember || selectedFcData.hasPendingRequest) && styles.joinBtnJoined,
              ]}
              activeOpacity={0.85}
              onPress={handleJoinLeaveFC}
              disabled={detailLoading || selectedFcData.hasPendingRequest}
            >
              <Text style={[styles.joinBtnText, (isMember || selectedFcData.hasPendingRequest) && styles.joinBtnTextJoined]}>
                {isMember
                  ? '✓ Đã tham gia'
                  : selectedFcData.hasPendingRequest
                  ? 'Đã gửi yêu cầu tham gia'
                  : 'Tham Gia'}
              </Text>
            </TouchableOpacity>

            <View style={styles.descRow}>
              <Text style={styles.descLabel}>Giới thiệu: </Text>
              <Text style={styles.descText}>
                {fc.description || 'FC chưa có thông tin giới thiệu.'}
              </Text>
            </View>
          </View>

          {/* Join request approval for owner */}
          {selectedFcData.isOwner && selectedFcData.pendingJoinRequests?.length > 0 && (
            <View style={styles.pendingRequestsCard}>
              <Text style={styles.sectionTitle}>Yêu cầu tham gia</Text>
              {selectedFcData.pendingJoinRequests.map((requestUser) => (
                <View key={requestUser._id} style={styles.pendingRequestRow}>
                  <View style={styles.pendingUserInfo}>
                    {requestUser.picture ? (
                      <Image source={{ uri: requestUser.picture }} style={styles.pendingAvatar} />
                    ) : (
                      <View style={[styles.pendingAvatar, { backgroundColor: '#f97316' }]}
                      >
                        <Text style={styles.pendingAvatarText}>{getInitials(requestUser.name)}</Text>
                      </View>
                    )}
                    <Text style={styles.pendingUserName}>{requestUser.name || 'Thành viên'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.approveRequestBtn}
                    onPress={async () => {
                      try {
                        setDetailLoading(true);
                        const res = await fetch(`${API_BASE_URL}/api/fc/${selectedFcId}/approve-join`, {
                          method: 'POST',
                          headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ userId: requestUser._id }),
                        });
                        const json = await res.json();
                        if (json.success) {
                          Alert.alert('Thành công', json.message);
                          loadFCDetails(selectedFcId);
                        } else {
                          Alert.alert('Lỗi', json.message || 'Không thể duyệt yêu cầu');
                        }
                      } catch (err) {
                        console.error('Approve join request error:', err);
                        Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
                      } finally {
                        setDetailLoading(false);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.approveRequestBtnText}>Chấp nhận</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Post publishing container (visible to members only) */}
          {isMember && (
            <View style={styles.publishingCard}>
              <TouchableOpacity
                style={styles.publishingPlaceholderRow}
                onPress={() => setShowPostBox(!showPostBox)}
                activeOpacity={0.7}
              >
                <View style={[styles.miniAvatar, { backgroundColor: '#f97316' }]}>
                  <Text style={styles.miniAvatarText}>
                    {getInitials(user?.name)}
                  </Text>
                </View>
                <Text style={styles.publishingPlaceholderText}>
                  Bạn đang nghĩ gì? Đăng bài lên FC...
                </Text>
              </TouchableOpacity>

              {showPostBox && (
                <View style={styles.postBoxContent}>
                  <TextInput
                    style={styles.postBoxInput}
                    placeholder="Viết nội dung bài viết..."
                    value={postContent}
                    onChangeText={setPostContent}
                    multiline
                  />

                  {/* Picked media list */}
                  {postAssets.length > 0 && (
                    <ScrollView horizontal style={styles.pickedImagesRow} showsHorizontalScrollIndicator={false}>
                      {postAssets.map((asset, idx) => (
                        <View key={idx} style={styles.pickedImageWrapper}>
                          <Image source={{ uri: asset.uri }} style={styles.pickedImagePreview} />
                          <TouchableOpacity
                            style={styles.removePickedImageBtn}
                            onPress={() => setPostAssets((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Ionicons name="close" size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  <View style={styles.postBoxActionRow}>
                    <TouchableOpacity style={styles.addMediaBtn} onPress={handlePickPostImage} activeOpacity={0.7}>
                      <Ionicons name="image-outline" size={20} color="#f97316" />
                      <Text style={styles.addMediaBtnText}>Ảnh/Video</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.publishPostBtn}
                      onPress={handleCreatePost}
                      activeOpacity={0.8}
                      disabled={postLoading}
                    >
                      {postLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.publishPostBtnText}>Đăng bài</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Posts list */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bài viết mới nhất</Text>
          </View>

          {posts.length === 0 ? (
            <View style={[styles.center, { padding: 40, backgroundColor: '#fff', margin: 12, borderRadius: 16 }]}>
              <Text style={styles.noDataText}>Chưa có bài viết nào trong FC này</Text>
            </View>
          ) : (
            posts.map((post) => {
              const authorName = post.userId?.name || 'Thành viên';
              const firstLetter = getInitials(authorName);
              const fcName = fc.name;
              const fcAvatar = fc.avatar;
              const fcFirstLetter = fcName ? fcName.charAt(0).toUpperCase() : '?';

              return (
                <View key={post._id} style={styles.postCard}>
                  {/* Post Header */}
                  <View style={[styles.postHeader, { justifyContent: 'space-between', width: '100%' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      {/* Overlapping Avatars: Club Avatar with User Avatar Badge */}
                      <View style={{ width: 40, height: 40, position: 'relative' }}>
                        {fcAvatar ? (
                          <Image source={{ uri: fixMediaUrl(fcAvatar) }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB' }} />
                        ) : (
                          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>{fcFirstLetter}</Text>
                          </View>
                        )}
                        {/* Overlapping User Avatar Badge */}
                        {post.userId?.picture ? (
                          <Image
                            source={{ uri: post.userId.picture }}
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              right: -2,
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              borderWidth: 1.5,
                              borderColor: '#FFFFFF',
                              backgroundColor: '#E5E7EB',
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              right: -2,
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              borderWidth: 1.5,
                              borderColor: '#FFFFFF',
                              backgroundColor: '#f97316',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>
                              {firstLetter}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' }}>{fcName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1, gap: 4, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#4B5563' }}>{authorName}</Text>
                          <Ionicons name="people" size={13} color="#FF6B35" />
                          <Text style={{ fontSize: 11, color: '#888' }}>
                            • {formatTimeAgo(post.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={{ padding: 8 }} 
                      activeOpacity={0.7} 
                      onPress={() => handlePostMoreOptions(post)}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color="#000000" />
                    </TouchableOpacity>
                  </View>

                  {/* Post Content */}
                  <Text style={styles.postContent}>{post.content}</Text>

                  {/* Post Images */}
                  {post.mediaUrls && post.mediaUrls.length > 0 && (
                    <View style={styles.postImagesContainer}>
                      <View style={styles.postImagesInnerGrid}>
                        {post.mediaUrls.map((url, i) => (
                          <View key={i} style={styles.postImageWrapper}>
                            <Image source={{ uri: fixMediaUrl(url) }} style={styles.postImage} resizeMode="cover" />
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Modal Xem danh sách thành viên */}
        <Modal
          visible={showMembersModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowMembersModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.bottomSheetContainer, { height: '80%' }]}>
              <View style={styles.bottomSheetHandle} />
              <Text style={[styles.bottomSheetTitle, { fontSize: 18, marginBottom: 8 }]}>Danh sách thành viên FC</Text>
              <Text style={{ fontSize: 13.5, color: '#6B7280', textAlign: 'center', marginBottom: 16 }}>
                Tổng cộng: {selectedFcData?.fc?.members?.length || 0} thành viên
              </Text>
              
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {selectedFcData && getSortedMembers(selectedFcData).map((member, index) => {
                  const isOwner = String(member._id) === String(selectedFcData.fc.createdBy?._id || selectedFcData.fc.createdBy);
                  const roleName = isOwner ? 'Chủ FC' : 'Thành viên';
                  const roleColor = isOwner ? '#EF4444' : '#6B7280';
                  const roleBg = isOwner ? '#FEE2E2' : '#F3F4F6';
                  const joinDate = member.createdAt 
                    ? new Date(member.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })
                    : 'Chưa rõ';
                  
                  return (
                    <View 
                      key={member._id || index}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F3F4F6',
                      }}
                    >
                      {member.picture ? (
                        <Image source={{ uri: member.picture }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                      ) : (
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>{member.name ? member.name.charAt(0).toUpperCase() : '?'}</Text>
                        </View>
                      )}
                      
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#111827' }}>{member.name || 'Thành viên'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                          <View style={{ backgroundColor: roleBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: roleColor, fontSize: 11, fontWeight: '700' }}>{roleName}</Text>
                          </View>
                          <Text style={{ fontSize: 11.5, color: '#9CA3AF' }}>Tham gia: {joinDate}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              
              <TouchableOpacity 
                style={styles.bottomSheetCancelBtn}
                onPress={() => setShowMembersModal(false)}
              >
                <Text style={styles.bottomSheetCancelText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Fallback Loading view
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#f97316" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  noDataText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },

  // App Header
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 9,
    marginTop: Platform.OS === 'ios' ? 8 : 16,
    marginBottom: 0,
    height: 74,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 94, 94, 0.19)',
    zIndex: 10,
  },
  appHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appLogo: {
    width: 44,
    height: 44,
    marginRight: -6,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  appTitleVibe: {
    color: '#1a1a1a',
  },
  appTitleSport: {
    color: '#f97316',
  },
  createFCBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  createFCBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search Bar
  searchBarContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111',
  },

  // FC List Item
  fcListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fcItemAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f3f4f6',
  },
  fcItemAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fcItemAvatarPlaceholderText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  fcItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fcItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  fcItemDesc: {
    fontSize: 12.5,
    color: '#6b7280',
    marginBottom: 6,
  },
  fcItemBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  fcItemBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  fcItemBadgeText: {
    fontSize: 10.5,
    color: '#4b5563',
    fontWeight: '600',
  },

  // Form Container
  formContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  formInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: '#111',
  },
  sportOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  sportOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
  },
  sportOptionActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  sportOptionText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  sportOptionTextActive: {
    color: '#fff',
  },
  avatarPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 6,
  },
  avatarPickerBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  avatarPickerPlaceholder: {
    alignItems: 'center',
  },
  avatarPickerHelper: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  removeAvatarBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeAvatarBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  toggleHelper: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: '#f97316',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  pendingRequestsCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pendingRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  pendingUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pendingAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pendingAvatarText: {
    color: '#fff',
    fontWeight: '700',
  },
  pendingUserName: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
  },
  approveRequestBtn: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginLeft: 10,
  },
  approveRequestBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Banner details
  bannerContainer: {
    height: BANNER_HEIGHT,
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },

  // Club header card
  clubHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginTop: -30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  clubLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#f97316',
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  clubLogo: {
    width: '100%',
    height: '100%',
  },
  clubLogoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubLogoPlaceholderText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  clubName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },

  // Club details card
  clubDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  infoValue: {
    fontSize: 14,
    color: '#4b5563',
  },
  joinBtn: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  joinBtnJoined: {
    backgroundColor: '#e5e7eb',
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  joinBtnTextJoined: {
    color: '#4b5563',
  },
  descRow: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
  },
  descLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  descText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },

  // Publishing Card
  publishingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  publishingPlaceholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  publishingPlaceholderText: {
    fontSize: 13.5,
    color: '#888',
    flex: 1,
  },
  postBoxContent: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  postBoxInput: {
    fontSize: 14,
    color: '#111',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  pickedImagesRow: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  pickedImageWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  pickedImagePreview: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  removePickedImageBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBoxActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  addMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff3ef',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addMediaBtnText: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '700',
  },
  publishPostBtn: {
    backgroundColor: '#f97316',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  publishPostBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Section Header
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a1a',
  },

  // Post Card
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 12,
    marginBottom: 10,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  postAuthorAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
  },
  postAuthorAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAuthorAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  postMeta: {
    flex: 1,
    marginLeft: 10,
  },
  postClubNameText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  postSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  postTime: {
    fontSize: 11,
    color: '#888',
  },
  postContent: {
    fontSize: 13.5,
    color: '#374151',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  postImagesContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 8,
    marginBottom: 4,
  },
  postImagesInnerGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  postImageWrapper: {
    flex: 1,
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  bottomSheetCancelBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  bottomSheetCancelText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '700',
  },
});
