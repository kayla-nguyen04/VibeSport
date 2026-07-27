import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { getMutualFriendsRequest } from '../services/userApi';
import { openConversation, updateGroupInfo } from '../redux/chatSlice';

const ORANGE = '#FF6B3D';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const GroupCreationModal = ({ visible, onClose, onGroupCreated }) => {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth?.token);

  const [step, setStep] = useState(1);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [groupName, setGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [selectedAvatarImage, setSelectedAvatarImage] = useState(null);
  const [pendingImageAction, setPendingImageAction] = useState(null);

  const loadMutualFriends = async () => {
    setLoadingFriends(true);
    try {
      const res = await getMutualFriendsRequest(token);
      setMutualFriends(res.data || []);
    } catch (err) {
      console.error('Fetch mutual friends error:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Load friends khi modal mở
  React.useEffect(() => {
    if (visible) {
      loadMutualFriends();
      setStep(1);
      setSelectedUserIds([]);
      setSearchText('');
      setGroupName('');
      setSelectedAvatarImage(null);
    }
  }, [visible]);

  const filteredFriends = React.useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return mutualFriends.filter((f) =>
      !keyword || f.name?.toLowerCase().includes(keyword)
    );
  }, [mutualFriends, searchText]);

  const handleToggleUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handlePickAvatar = () => {
    Alert.alert(
      'Chọn ảnh đại diện nhóm',
      'Chọn phương thức để lấy ảnh',
      [
        {
          text: 'Chụp ảnh mới',
          onPress: () => {
            if (Platform.OS === 'ios') {
              setPendingImageAction('camera');
              onClose();
            } else {
              processImagePick('camera');
            }
          },
        },
        {
          text: 'Chọn từ thư viện',
          onPress: () => {
            if (Platform.OS === 'ios') {
              setPendingImageAction('library');
              onClose();
            } else {
              processImagePick('library');
            }
          },
        },
        { text: 'Hủy', style: 'cancel' },
      ]
    );
  };

  const processImagePick = async (mode) => {
    try {
      let result;
      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập máy ảnh.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
      }
      if (!result.canceled && result.assets?.length > 0) {
        setSelectedAvatarImage(result.assets[0]);
      }
    } catch (err) {
      console.error('Lỗi chọn ảnh nhóm:', err);
      Alert.alert('Lỗi', 'Không thể chọn ảnh.');
    } finally {
      setPendingImageAction(null);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUserIds.length < 1) return;
    setCreatingGroup(true);
    try {
      const result = await dispatch(
        openConversation({ recipientIds: selectedUserIds, name: groupName.trim() })
      ).unwrap();

      const newConv = result.data;

      if (selectedAvatarImage && newConv?._id) {
        try {
          const formData = new FormData();
          formData.append('name', groupName.trim());
          const uri = selectedAvatarImage.uri;
          const uriParts = uri.split('.');
          const fileType = uriParts[uriParts.length - 1];
          const fileName = uri.split('/').pop();
          formData.append('avatar', {
            uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
            name: fileName || `avatar.${fileType}`,
            type: `image/${fileType}`,
          });
          await dispatch(updateGroupInfo({ conversationId: newConv._id, formData })).unwrap();
        } catch (uploadErr) {
          console.error('Lỗi upload avatar nhóm:', uploadErr);
          Alert.alert('Thông báo', 'Đã tạo nhóm nhưng không thể tải lên ảnh đại diện.');
        }
      }

      if (onGroupCreated) onGroupCreated(newConv);
      onClose();
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể tạo nhóm trò chuyện');
    } finally {
      setCreatingGroup(false);
    }
  };

  const renderFriendItem = ({ item }) => {
    const uid = item._id || item.id;
    const isSelected = selectedUserIds.includes(uid);
    return (
      <TouchableOpacity
        style={[styles.friendItem, isSelected && styles.friendItemSelected]}
        onPress={() => handleToggleUser(uid)}
        activeOpacity={0.7}
      >
        {item.picture ? (
          <Image source={{ uri: item.picture }} style={styles.friendAvatar} />
        ) : (
          <View style={styles.friendAvatarFallback}>
            <Text style={styles.friendAvatarFallbackText}>{getInitials(item.name)}</Text>
          </View>
        )}
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.name}</Text>
          {item.email ? <Text style={styles.friendEmail}>{item.email}</Text> : null}
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={() => {
        if (Platform.OS === 'ios' && pendingImageAction) {
          processImagePick(pendingImageAction);
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Step 1: Chọn thành viên */}
          {step === 1 ? (
            <>
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.cancelBtn}>Hủy</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Nhóm mới</Text>
                <TouchableOpacity
                  onPress={() => setStep(2)}
                  disabled={selectedUserIds.length < 1}
                >
                  <Text style={[styles.nextBtn, selectedUserIds.length < 1 && styles.nextBtnDisabled]}>
                    Tiếp
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.searchWrap}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={16} color="#8E8E93" />
                  <TextInput
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Tìm kiếm"
                    placeholderTextColor="#8E8E93"
                    style={styles.searchInput}
                  />
                </View>
              </View>

              {selectedUserIds.length > 0 && (
                <Text style={styles.selectedCount}>
                  Đã chọn: {selectedUserIds.length} người
                </Text>
              )}

              <Text style={styles.sectionLabel}>Gợi ý</Text>
              {loadingFriends ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color="#0A84FF" />
                </View>
              ) : (
                <FlatList
                  data={filteredFriends}
                  keyExtractor={(item) => String(item._id || item.id)}
                  renderItem={renderFriendItem}
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>Không tìm thấy người dùng phù hợp</Text>
                  }
                />
              )}
            </>
          ) : (
            /* Step 2: Đặt tên nhóm & ảnh */
            <>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setStep(1)}>
                  <Text style={styles.cancelBtn}>Quay lại</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Tên nhóm</Text>
                <TouchableOpacity
                  onPress={handleCreateGroup}
                  disabled={creatingGroup || !groupName.trim()}
                >
                  {creatingGroup ? (
                    <ActivityIndicator size="small" color="#0A84FF" />
                  ) : (
                    <Text style={[styles.nextBtn, !groupName.trim() && styles.nextBtnDisabled]}>
                      Tạo
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.creationBody}>
                <TouchableOpacity
                  onPress={handlePickAvatar}
                  style={styles.avatarPicker}
                  activeOpacity={0.8}
                >
                  {selectedAvatarImage ? (
                    <Image source={{ uri: selectedAvatarImage.uri }} style={styles.avatarPreview} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Ionicons name="camera" size={32} color="#8E8E93" />
                      <Text style={styles.avatarFallbackText}>Thêm ảnh</Text>
                    </View>
                  )}
                  {selectedAvatarImage && (
                    <View style={styles.avatarBadge}>
                      <Ionicons name="camera" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.nameInputWrap}>
                  <TextInput
                    value={groupName}
                    onChangeText={setGroupName}
                    placeholder="Nhập tên nhóm..."
                    placeholderTextColor="#8E8E93"
                    style={styles.nameInput}
                    autoFocus
                    maxLength={50}
                  />
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  cancelBtn: {
    fontSize: 16,
    color: '#8E8E93',
  },
  nextBtn: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A84FF',
  },
  nextBtnDisabled: {
    color: '#C7C7CC',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
  },
  selectedCount: {
    fontSize: 13,
    color: ORANGE,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    paddingHorizontal: 16,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    gap: 12,
  },
  friendItemSelected: {
    backgroundColor: '#FFF3EF',
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  friendAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarFallbackText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  friendEmail: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 30,
  },
  // Step 2
  creationBody: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 24,
    gap: 20,
  },
  avatarPicker: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarPreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  avatarFallbackText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: ORANGE,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInputWrap: {
    width: '100%',
    borderBottomWidth: 1.5,
    borderBottomColor: ORANGE,
    paddingBottom: 6,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'center',
  },
});

export default GroupCreationModal;
