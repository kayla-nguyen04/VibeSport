import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  updateGroupInfo,
  addParticipants,
} from '../redux/chatSlice';
import { API_BASE_URL } from '../components/constants/api';
import { getMutualFriendsRequest } from '../services/userApi';

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[charCodeSum % AVATAR_COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

function fixMediaUrl(url) {
  if (!url) return url;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

export default function GroupManagementScreen({ route, navigation }) {
  const { conversationId } = route.params;
  const dispatch = useDispatch();

  const token = useSelector((state) => state.auth.token);
  const conversations = useSelector((state) => state.chat.conversations);
  const user = useSelector((state) => state.auth.user);
  const currentUserId = useMemo(() => user?.id || user?._id, [user]);
  const insets = useSafeAreaInsets();

  const conversationMeta = useMemo(() => {
    return conversations.find((item) => item._id === conversationId);
  }, [conversations, conversationId]);

  const peerName = conversationMeta?.name || 'Nhóm VibeSport';

  // Group editing & adding member states
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedAvatarImage, setSelectedAvatarImage] = useState(null);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'admin'

  // Sync edit group name state
  useEffect(() => {
    if (showEditGroupModal) {
      setNewGroupName(peerName);
      setSelectedAvatarImage(null);
    }
  }, [showEditGroupModal, peerName]);

  // Load mutual friends & clear search
  useEffect(() => {
    if (showAddMemberModal || showMembersModal) {
      loadMutualFriendsForAdd();
      setSearchText('');
    }
  }, [showAddMemberModal, showMembersModal]);

  const filteredFriends = useMemo(() => {
    return mutualFriends.filter((friend) => {
      const isAlreadyInGroup = conversationMeta?.participants?.some(
        (p) => String(p._id || p) === String(friend._id)
      );
      if (isAlreadyInGroup) return false;
      
      if (!searchText.trim()) return true;
      return friend.name.toLowerCase().includes(searchText.toLowerCase());
    });
  }, [mutualFriends, conversationMeta, searchText]);

  const loadMutualFriendsForAdd = async () => {
    setLoadingFriends(true);
    setSelectedUserIds([]);
    try {
      const res = await getMutualFriendsRequest(token);
      setMutualFriends(res.data || []);
    } catch (err) {
      console.error('Lỗi lấy danh sách bạn bè:', err);
      Alert.alert('Lỗi', 'Không thể tải danh sách bạn bè');
    } finally {
      setLoadingFriends(false);
    }
  };

  const handlePickGroupAvatar = () => {
    Alert.alert(
      'Cập nhật ảnh đại diện nhóm',
      'Chọn phương thức để lấy ảnh',
      [
        { text: 'Chụp ảnh mới', onPress: () => processGroupImagePick('camera') },
        { text: 'Chọn từ thư viện', onPress: () => processGroupImagePick('library') },
        { text: 'Hủy', style: 'cancel' }
      ]
    );
  };

  const processGroupImagePick = async (mode) => {
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
          quality: 0.5,
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
          quality: 0.5,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedAvatarImage(result.assets[0]);
      }
    } catch (err) {
      console.error('Lỗi chọn ảnh nhóm:', err);
      Alert.alert('Lỗi', 'Không thể chọn ảnh.');
    }
  };

  const handleSaveGroupInfo = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }

    setIsUpdatingGroup(true);
    try {
      const formData = new FormData();
      formData.append('name', trimmed);

      if (selectedAvatarImage) {
        const uri = selectedAvatarImage.uri;
        const uriParts = uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        const fileName = uri.split('/').pop();

        formData.append('avatar', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: fileName || `avatar.${fileType}`,
          type: `image/${fileType}`,
        });
      }

      await dispatch(updateGroupInfo({ conversationId, formData })).unwrap();
      Alert.alert('Thành công', 'Cập nhật thông tin nhóm thành công');
      setShowEditGroupModal(false);
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể cập nhật thông tin nhóm');
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const handleConfirmAddMembers = async () => {
    if (selectedUserIds.length === 0) return;
    setIsAddingMembers(true);
    try {
      await dispatch(addParticipants({ conversationId, userIds: selectedUserIds })).unwrap();
      Alert.alert('Thành công', 'Đã thêm thành viên vào nhóm');
      setShowAddMemberModal(false);
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể thêm thành viên');
    } finally {
      setIsAddingMembers(false);
    }
  };

  // Helpers for member mock usernames and adder info
  const getMockUsername = (name) => {
    if (!name) return 'user';
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, '.');
  };

  const getMockAddedBy = (item, participants = [], currentUserId, mutualFriends = []) => {
    const hasDetails = typeof item === 'object' && item !== null;
    const name = hasDetails ? item.name : '';
    const itemId = hasDetails ? item._id : item;
    
    const username = getMockUsername(name);
    
    // Check if friend
    const isFriend = mutualFriends.some((f) => String(f._id) === String(itemId));
    
    if (isFriend) {
      return `@${username} • Do bạn thêm`;
    }
    
    // Otherwise, pick another participant deterministically
    const others = (participants || []).filter(
      (p) => String((typeof p === 'object' && p !== null) ? p._id : p) !== String(itemId)
    );
    
    if (others.length === 0) {
      return `@${username} • Do bạn thêm`;
    }
    
    // Use character code sum of itemId to deterministically select an adder
    const idStr = String(itemId);
    const sum = idStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const adder = others[sum % others.length];
    
    const adderId = (typeof adder === 'object' && adder !== null) ? adder._id : adder;
    const adderName = (typeof adder === 'object' && adder !== null) ? adder.name : 'Thành viên VibeSport';
    
    if (String(adderId) === String(currentUserId)) {
      return `@${username} • Do bạn thêm`;
    }
    
    return `@${username} • ${adderName} đã thêm`;
  };

  // Group participants by friendship status
  const friendsInGroup = useMemo(() => {
    if (!conversationMeta?.participants) return [];
    return conversationMeta.participants.filter((p) => {
      const hasDetails = typeof p === 'object' && p !== null;
      const pId = hasDetails ? p._id : p;
      if (!pId) return false;
      if (String(pId) === String(currentUserId)) return false;
      return mutualFriends.some((f) => String(f._id) === String(pId));
    });
  }, [conversationMeta?.participants, mutualFriends, currentUserId]);

  const othersInGroup = useMemo(() => {
    if (!conversationMeta?.participants) return [];
    return conversationMeta.participants.filter((p) => {
      const hasDetails = typeof p === 'object' && p !== null;
      const pId = hasDetails ? p._id : p;
      if (!pId) return false;
      if (String(pId) === String(currentUserId)) return true;
      return !mutualFriends.some((f) => String(f._id) === String(pId));
    });
  }, [conversationMeta?.participants, mutualFriends, currentUserId]);

  const admins = useMemo(() => {
    if (!conversationMeta?.participants || conversationMeta.participants.length === 0) return [];
    return [conversationMeta.participants[0]];
  }, [conversationMeta?.participants]);

  const memberListData = useMemo(() => {
    if (activeTab === 'admin') {
      return admins.map((item) => ({ type: 'member', data: item, isAdmin: true }));
    }

    const data = [];
    if (friendsInGroup.length > 0) {
      data.push({ type: 'header', title: 'Bạn bè', hasSeeAll: true });
      friendsInGroup.forEach((item) => {
        data.push({ type: 'member', data: item, isFriend: true });
      });
    }

    if (othersInGroup.length > 0) {
      data.push({ type: 'header', title: 'Thành viên khác', hasSeeAll: false });
      othersInGroup.forEach((item) => {
        data.push({ type: 'member', data: item, isFriend: false });
      });
    }

    return data;
  }, [activeTab, friendsInGroup, othersInGroup, admins]);

  return (
    <Screen style={styles.screen}>
      <ScreenHeader style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Quản lý nhóm</Text>
        <View style={styles.headerRightPlaceholder} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Profile Section */}
        <View style={styles.profileSection}>
          {conversationMeta?.peer?.picture ? (
            <Image source={{ uri: fixMediaUrl(conversationMeta.peer.picture) }} style={styles.groupAvatar} />
          ) : (
            <View style={[styles.groupAvatarFallback, { backgroundColor: getAvatarColor(peerName) }]}>
              <Text style={styles.groupAvatarText}>{getInitials(peerName)}</Text>
            </View>
          )}
          
          <Text style={styles.groupName} numberOfLines={2}>
            {peerName}
          </Text>
          
          <Text style={styles.activityStatus}>
            Hoạt động hôm nay
          </Text>

          <TouchableOpacity onPress={() => setShowEditGroupModal(true)} activeOpacity={0.7}>
            <Text style={styles.changeInfoText}>Đổi tên hoặc ảnh</Text>
          </TouchableOpacity>
        </View>




        {/* Conversation Info Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Thông tin về đoạn chat</Text>
          <View style={styles.cardContainer}>
            <TouchableOpacity 
              style={[styles.listItem, styles.lastListItem]} 
              activeOpacity={0.7}
              onPress={() => setShowMembersModal(true)}
            >
              <View style={[styles.listIconWrap, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="people" size={20} color="#4B5563" />
              </View>
              <Text style={styles.listItemText}>Xem thành viên trong đoạn chat</Text>
              <View style={styles.memberCountBadge}>
                <Text style={styles.memberCountText}>
                  {conversationMeta?.participants?.length || 0}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Group Modal */}
      <Modal
        visible={showEditGroupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditGroupModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowEditGroupModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardModalOverlay}
          >
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Chỉnh sửa nhóm</Text>
                  <TouchableOpacity onPress={() => setShowEditGroupModal(false)} hitSlop={10}>
                    <Ionicons name="close" size={24} color="#111827" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <TouchableOpacity
                    onPress={handlePickGroupAvatar}
                    style={styles.groupAvatarPicker}
                    activeOpacity={0.8}
                  >
                    {selectedAvatarImage ? (
                      <Image source={{ uri: selectedAvatarImage.uri }} style={styles.groupAvatarPreview} />
                    ) : conversationMeta?.peer?.picture ? (
                      <Image source={{ uri: fixMediaUrl(conversationMeta.peer.picture) }} style={styles.groupAvatarPreview} />
                    ) : (
                      <View style={[styles.groupAvatarPreviewFallback, { backgroundColor: getAvatarColor(peerName) }]}>
                        <Text style={styles.groupAvatarText}>{getInitials(peerName)}</Text>
                      </View>
                    )}
                    <View style={styles.groupAvatarBadge}>
                      <Ionicons name="camera" size={16} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>

                  <Text style={styles.inputLabel}>Tên nhóm</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newGroupName}
                    onChangeText={setNewGroupName}
                    placeholder="Nhập tên nhóm mới"
                    placeholderTextColor="#9CA3AF"
                    maxLength={50}
                  />
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    onPress={() => setShowEditGroupModal(false)}
                    style={styles.cancelButton}
                    disabled={isUpdatingGroup}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveGroupInfo}
                    style={styles.saveButton}
                    disabled={isUpdatingGroup}
                  >
                    {isUpdatingGroup ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Lưu</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowAddMemberModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, styles.tallModalContent]}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowAddMemberModal(false)} hitSlop={10}>
                    <Text style={styles.cancelText}>Hủy</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Chọn người</Text>
                  <TouchableOpacity
                    onPress={handleConfirmAddMembers}
                    disabled={isAddingMembers || selectedUserIds.length === 0}
                    hitSlop={10}
                  >
                    <Text style={[
                      styles.confirmText,
                      (isAddingMembers || selectedUserIds.length === 0) && styles.disabledConfirmText
                    ]}>
                      Thêm{selectedUserIds.length > 0 ? ` (${selectedUserIds.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.searchBarContainer}>
                  <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Tìm kiếm"
                    placeholderTextColor="#9CA3AF"
                    clearButtonMode="while-editing"
                  />
                </View>

                <Text style={styles.suggestionsHeader}>Gợi ý</Text>

                {loadingFriends ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color="#0b74ff" />
                  </View>
                ) : (
                  <FlatList
                    data={filteredFriends}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.friendsList}
                    ListEmptyComponent={
                      <View style={styles.emptyFriendsWrap}>
                        <Text style={styles.emptyFriendsText}>Không tìm thấy bạn bè nào</Text>
                      </View>
                    }
                    renderItem={({ item }) => {
                      const isSelected = selectedUserIds.includes(item._id);
                      const isOnline = item.lastSeenAt && (Date.now() - new Date(item.lastSeenAt).getTime() < 5 * 60 * 1000);
                      return (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedUserIds((prev) =>
                              prev.includes(item._id)
                                ? prev.filter((id) => id !== item._id)
                                : [...prev, item._id]
                            );
                          }}
                          style={styles.friendItem}
                        >
                          <View style={styles.friendAvatarContainer}>
                            {item.picture ? (
                              <Image source={{ uri: fixMediaUrl(item.picture) }} style={styles.friendAvatar} />
                            ) : (
                              <View style={[styles.friendAvatarFallback, { backgroundColor: getAvatarColor(item.name) }]}>
                                <Text style={styles.friendAvatarText}>{getInitials(item.name)}</Text>
                              </View>
                            )}
                            {isOnline && <View style={styles.onlineBadge} />}
                          </View>
                          <Text style={styles.friendName}>{item.name}</Text>
                          <Ionicons
                            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={24}
                            color={isSelected ? '#0b74ff' : '#D1D5DB'}
                            style={styles.checkboxIcon}
                          />
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showMembersModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={styles.darkModalContainer}>
          {/* Header */}
          <View style={[styles.darkHeader, { paddingTop: insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 44 : 16) }]}>
            <TouchableOpacity onPress={() => setShowMembersModal(false)} style={styles.darkHeaderBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color="#111827" />
            </TouchableOpacity>
            
            <View style={styles.darkHeaderTitleWrap}>
              <Text style={styles.darkHeaderTitle}>Thành viên</Text>
              <Text style={styles.darkHeaderSubtitle}>
                {conversationMeta?.participants?.length || 0} người
              </Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => {
                setShowAddMemberModal(true);
              }} 
              style={styles.darkHeaderBtn}
              hitSlop={10}
            >
              <Ionicons name="add" size={28} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Tab Selector */}
          <View style={styles.darkTabBar}>
            <TouchableOpacity 
              style={[styles.darkTabBtn, activeTab === 'all' && styles.darkActiveTabBtn]} 
              onPress={() => setActiveTab('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.darkTabLabel, activeTab === 'all' && styles.darkActiveTabLabel]}>
                Tất cả
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.darkTabBtn, activeTab === 'admin' && styles.darkActiveTabBtn]} 
              onPress={() => setActiveTab('admin')}
              activeOpacity={0.8}
            >
              <Text style={[styles.darkTabLabel, activeTab === 'admin' && styles.darkActiveTabLabel]}>
                Quản trị viên
              </Text>
            </TouchableOpacity>
          </View>

          {/* Member List */}
          <FlatList
            data={memberListData}
            keyExtractor={(item, index) => item.type + '-' + (item.data?._id || index)}
            contentContainerStyle={[styles.darkListContent, { paddingBottom: 40 + insets.bottom }]}
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return (
                  <View style={styles.darkSectionHeaderWrap}>
                    <Text style={styles.darkSectionHeader}>{item.title}</Text>
                    {item.hasSeeAll && (
                      <TouchableOpacity 
                        onPress={() => {
                          Alert.alert('Bạn bè', 'Tính năng đang phát triển');
                        }} 
                        activeOpacity={0.7}
                      >
                        <Text style={styles.darkSeeAllBtnText}>Xem tất cả</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }

              const member = item.data;
              const hasDetails = typeof member === 'object' && member !== null;
              const name = hasDetails ? member.name : 'Thành viên VibeSport';
              const picture = hasDetails ? member.picture : null;
              const isOnline = hasDetails && member.lastSeenAt && (Date.now() - new Date(member.lastSeenAt).getTime() < 5 * 60 * 1000);
              const isMe = hasDetails && String(member._id) === String(currentUserId);
              
              const subtitleText = hasDetails ? getMockAddedBy(member, conversationMeta?.participants, currentUserId, mutualFriends) : '';

              return (
                <View style={styles.darkFriendItem}>
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={() => {
                      if (hasDetails && member._id) {
                        setShowMembersModal(false);
                        navigation.navigate('UserProfile', { userId: member._id });
                      }
                    }}
                    style={styles.darkFriendAvatarContainer}
                  >
                    {picture ? (
                      <Image source={{ uri: fixMediaUrl(picture) }} style={styles.darkFriendAvatar} />
                    ) : (
                      <View style={[styles.darkFriendAvatarFallback, { backgroundColor: getAvatarColor(name) }]}>
                        <Text style={styles.darkFriendAvatarText}>{getInitials(name)}</Text>
                      </View>
                    )}
                    {isOnline && <View style={styles.darkOnlineBadge} />}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={() => {
                      if (hasDetails && member._id) {
                        setShowMembersModal(false);
                        navigation.navigate('UserProfile', { userId: member._id });
                      }
                    }}
                    style={styles.darkFriendInfoWrap}
                  >
                    <Text style={styles.darkFriendName}>{name}</Text>
                    {subtitleText ? (
                      <Text style={styles.darkFriendSubtitle} numberOfLines={1}>
                        {subtitleText}
                      </Text>
                    ) : null}
                  </TouchableOpacity>

                  {/* Actions on the right side */}
                  {activeTab === 'all' && !item.isFriend && !isMe ? (
                    name === 'Người dùng Facebook' ? (
                      <TouchableOpacity 
                        style={styles.darkMoreBtn} 
                        activeOpacity={0.8}
                        onPress={() => {
                          Alert.alert('Thông tin', 'Tài khoản không hoạt động hoặc không khả dụng.');
                        }}
                      >
                        <Ionicons name="information-circle-outline" size={22} color="#8E8E93" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={styles.darkAddFriendBtn} 
                        activeOpacity={0.8}
                        onPress={() => {
                          Alert.alert(
                            'Kết bạn',
                            `Gửi lời mời kết bạn đến ${name}?`,
                            [
                              { text: 'Hủy', style: 'cancel' },
                              { text: 'Gửi', onPress: () => Alert.alert('Thành công', `Đã gửi lời mời kết bạn đến ${name}`) }
                            ]
                          );
                        }}
                      >
                        <Text style={styles.darkAddFriendBtnText}>Thêm bạn bè</Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    <TouchableOpacity 
                      style={styles.darkMoreBtn} 
                      activeOpacity={0.8}
                      onPress={() => {
                        Alert.alert(
                          name,
                          isMe ? 'Đây là tài khoản của bạn' : 'Chọn thao tác',
                          isMe 
                            ? [{ text: 'Đóng', style: 'cancel' }]
                            : [
                                { 
                                  text: 'Xem trang cá nhân', 
                                  onPress: () => {
                                    setShowMembersModal(false);
                                    navigation.navigate('UserProfile', { userId: member._id });
                                  } 
                                },
                                { text: 'Hủy', style: 'cancel' }
                              ]
                        );
                      }}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  groupAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  groupAvatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  groupAvatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  groupName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 6,
  },
  activityStatus: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  changeInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0b74ff',
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  actionBtnWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  circleIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastListItem: {
    borderBottomWidth: 0,
  },
  listIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  disabledLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  memberCountBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  memberCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  groupAvatarPicker: {
    position: 'relative',
    marginBottom: 20,
    alignSelf: 'center',
  },
  groupAvatarPreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E5E7EB',
  },
  groupAvatarPreviewFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  groupAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0b74ff',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0b74ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingWrap: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsList: {
    paddingVertical: 10,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  friendAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  memberArea: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  checkboxIcon: {
    marginLeft: 10,
  },
  emptyFriendsWrap: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFriendsText: {
    color: '#9CA3AF',
    fontSize: 15,
    textAlign: 'center',
  },
  tallModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 16,
    height: '93%',
  },
  cancelText: {
    fontSize: 16,
    color: '#0b74ff',
    fontWeight: '500',
  },
  confirmText: {
    fontSize: 16,
    color: '#0b74ff',
    fontWeight: '700',
  },
  disabledConfirmText: {
    color: '#9CA3AF',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    height: '100%',
  },
  suggestionsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
  },
  friendAvatarContainer: {
    position: 'relative',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  keyboardModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    width: '100%',
  },
  darkModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  darkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  darkHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkHeaderTitleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  darkHeaderSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  darkTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 12,
    gap: 8,
  },
  darkTabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  darkActiveTabBtn: {
    backgroundColor: '#F3F4F6',
  },
  darkTabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  darkActiveTabLabel: {
    color: '#111827',
  },
  darkListContent: {
    paddingBottom: 40,
  },
  darkSectionHeaderWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  darkSectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  darkSeeAllBtnText: {
    fontSize: 14,
    color: '#0b74ff',
    fontWeight: '500',
  },
  darkFriendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  darkFriendAvatarContainer: {
    position: 'relative',
  },
  darkFriendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E7EB',
  },
  darkFriendAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkFriendAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  darkFriendInfoWrap: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  darkFriendName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  darkFriendSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  darkAddFriendBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  darkAddFriendBtnText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  darkMoreBtn: {
    padding: 8,
  },
  darkOnlineBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
