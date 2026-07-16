import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import {
  fetchChatUnreadCount,
  fetchConversations,
  acceptConversation,
  blockConversation,
  unblockConversation,
  deleteConversation,
  muteConversation,
  unmuteConversation,
  openConversation,
  updateGroupInfo,
  leaveGroup,
} from '../redux/chatSlice';
import { API_BASE_URL } from '../components/constants/api';
import { getMutualFriendsRequest } from '../services/userApi';
import * as ImagePicker from 'expo-image-picker';
import { isUserOnline } from '../utils/presence';
import { color } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];
const FILTERS = ['Tất cả', 'Chưa đọc', 'Chưa trả lời'];

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

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins}p`;
  if (diffHours < 24) return `${diffHours}g`;
  if (diffDays < 7) return `${diffDays}n`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const cleanLastMessage = (text) => {
  if (!text) return 'Bắt đầu trò chuyện';
  // Clean up Mojibake encoding error for image messages (e.g. containing corrupted characters and ending with 'Ảnh')
  if ((text.includes('ð') || text.includes('ï') || text.includes('')) && text.includes('Ảnh')) {
    return '📷 Ảnh';
  }
  return text;
};

export default function ChatListScreen({ navigation }) {
  const dispatch = useDispatch();
  const { conversations, loadingConversations } = useSelector((state) => state.chat);
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);

  const renderConversationAvatar = (item) => {
    const peer = item.peer;
    const peerName = peer?.name || 'Thành viên VibeSport';
    
    // Single chat OR Group chat with custom avatar
    if (!item.isGroup || (peer && peer.picture)) {
      const pictureUrl = peer?.picture;
      return (
        <View style={{ position: 'relative' }}>
          {pictureUrl ? (
            <Image
              source={{ uri: fixMediaUrl(pictureUrl) }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                { backgroundColor: getAvatarColor(peerName) },
              ]}
            >
              <Text style={styles.avatarText}>{getInitials(peerName)}</Text>
            </View>
          )}
          {!item.isGroup && peer?.lastSeenAt && isUserOnline(peer.lastSeenAt) && (
            <View style={styles.onlineDot} />
          )}
        </View>
      );
    }
    
    // Group chat with NO custom avatar - Show layered circles like Zalo
    const currentUserId = user?._id;
    const otherMembers = (item.participants || []).filter(
      (p) => String(p._id || p) !== String(currentUserId)
    );
    
    const totalCount = otherMembers.length;
    
    if (totalCount === 0) {
      return (
        <View style={[styles.avatarFallback, { backgroundColor: getAvatarColor(peerName) }]}>
          <Text style={styles.avatarText}>{getInitials(peerName)}</Text>
        </View>
      );
    }
    
    if (totalCount === 1) {
      const singleMember = otherMembers[0];
      const displayName = singleMember.name || 'User';
      return (
        <View style={{ position: 'relative' }}>
          {singleMember.picture ? (
            <Image
              source={{ uri: fixMediaUrl(singleMember.picture) }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                { backgroundColor: getAvatarColor(displayName) },
              ]}
            >
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            </View>
          )}
        </View>
      );
    }
    
    if (totalCount === 2) {
      const m0 = otherMembers[0];
      const m1 = otherMembers[1];
      
      return (
        <View style={styles.groupAvatarGrid}>
          {/* Member 1 (top-left) */}
          <View style={[styles.groupAvatarItem, { width: 34, height: 34, borderRadius: 17, top: 2, left: 2, backgroundColor: getAvatarColor(m0.name) }]}>
            {m0.picture ? (
              <Image source={{ uri: fixMediaUrl(m0.picture) }} style={{ width: 31, height: 31, borderRadius: 15.5 }} resizeMode="cover" />
            ) : (
              <Text style={[styles.groupAvatarItemText, { fontSize: 12 }]}>{getInitials(m0.name)}</Text>
            )}
          </View>
          {/* Member 2 (bottom-right) */}
          <View style={[styles.groupAvatarItem, { width: 34, height: 34, borderRadius: 17, bottom: 2, right: 2, backgroundColor: getAvatarColor(m1.name) }]}>
            {m1.picture ? (
              <Image source={{ uri: fixMediaUrl(m1.picture) }} style={{ width: 31, height: 31, borderRadius: 15.5 }} resizeMode="cover" />
            ) : (
              <Text style={[styles.groupAvatarItemText, { fontSize: 12 }]}>{getInitials(m1.name)}</Text>
            )}
          </View>
        </View>
      );
    }
    
    if (totalCount === 3) {
      const m0 = otherMembers[0];
      const m1 = otherMembers[1];
      const m2 = otherMembers[2];
      
      return (
        <View style={styles.groupAvatarGrid}>
          <View style={[styles.groupAvatarItem, { width: 27, height: 27, borderRadius: 13.5, top: 1, left: 1, backgroundColor: getAvatarColor(m0.name) }]}>
            {m0.picture ? (
              <Image source={{ uri: fixMediaUrl(m0.picture) }} style={{ width: 24, height: 24, borderRadius: 12 }} resizeMode="cover" />
            ) : (
              <Text style={styles.groupAvatarItemText}>{getInitials(m0.name)}</Text>
            )}
          </View>
          <View style={[styles.groupAvatarItem, { width: 27, height: 27, borderRadius: 13.5, top: 1, right: 1, backgroundColor: getAvatarColor(m1.name) }]}>
            {m1.picture ? (
              <Image source={{ uri: fixMediaUrl(m1.picture) }} style={{ width: 24, height: 24, borderRadius: 12 }} resizeMode="cover" />
            ) : (
              <Text style={styles.groupAvatarItemText}>{getInitials(m1.name)}</Text>
            )}
          </View>
          <View style={[styles.groupAvatarItem, { width: 27, height: 27, borderRadius: 13.5, bottom: 1, left: 14.5, backgroundColor: getAvatarColor(m2.name) }]}>
            {m2.picture ? (
              <Image source={{ uri: fixMediaUrl(m2.picture) }} style={{ width: 24, height: 24, borderRadius: 12 }} resizeMode="cover" />
            ) : (
              <Text style={styles.groupAvatarItemText}>{getInitials(m2.name)}</Text>
            )}
          </View>
        </View>
      );
    }
    
    // 4 or more members
    const m0 = otherMembers[0];
    const m1 = otherMembers[1];
    const m2 = otherMembers[2];
    const m3 = otherMembers[3];
    const hasMore = totalCount > 4;
    const remainingText = (totalCount - 3) > 9 ? '9+' : `+${totalCount - 3}`;
    
    return (
      <View style={styles.groupAvatarGrid}>
        <View style={[styles.groupAvatarItem, { width: 27, height: 27, borderRadius: 13.5, top: 1, left: 1, backgroundColor: getAvatarColor(m0.name) }]}>
          {m0.picture ? (
            <Image source={{ uri: fixMediaUrl(m0.picture) }} style={{ width: 24, height: 24, borderRadius: 12 }} resizeMode="cover" />
          ) : (
            <Text style={styles.groupAvatarItemText}>{getInitials(m0.name)}</Text>
          )}
        </View>
        <View style={[styles.groupAvatarItem, { width: 27, height: 27, borderRadius: 13.5, top: 1, right: 1, backgroundColor: getAvatarColor(m1.name) }]}>
          {m1.picture ? (
            <Image source={{ uri: fixMediaUrl(m1.picture) }} style={{ width: 24, height: 24, borderRadius: 12 }} resizeMode="cover" />
          ) : (
            <Text style={styles.groupAvatarItemText}>{getInitials(m1.name)}</Text>
          )}
        </View>
        <View style={[styles.groupAvatarItem, { width: 27, height: 27, borderRadius: 13.5, bottom: 1, left: 1, backgroundColor: getAvatarColor(m2.name) }]}>
          {m2.picture ? (
            <Image source={{ uri: fixMediaUrl(m2.picture) }} style={{ width: 24, height: 24, borderRadius: 12 }} resizeMode="cover" />
          ) : (
            <Text style={styles.groupAvatarItemText}>{getInitials(m2.name)}</Text>
          )}
        </View>
        {hasMore ? (
          <View style={[styles.groupAvatarItem, { width: 27, height: 27, borderRadius: 13.5, bottom: 1, right: 1, backgroundColor: '#07823b' }]}>
            <Text style={styles.groupAvatarItemText}>{remainingText}</Text>
          </View>
        ) : (
          <View style={[styles.groupAvatarItem, { width: 27, height: 27, borderRadius: 13.5, bottom: 1, right: 1, backgroundColor: getAvatarColor(m3.name) }]}>
            {m3.picture ? (
              <Image source={{ uri: fixMediaUrl(m3.picture) }} style={{ width: 24, height: 24, borderRadius: 12 }} resizeMode="cover" />
            ) : (
              <Text style={styles.groupAvatarItemText}>{getInitials(m3.name)}</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');
  const [activeFilter, setActiveFilter] = useState('Tất cả');
  const [showFilter, setShowFilter] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const unreadNotificationCount = useSelector((state) => state.notifications?.unreadCount || 0);

  const [pinnedConversationIds, setPinnedConversationIds] = useState([]);

  React.useEffect(() => {
    const loadPinned = async () => {
      try {
        const value = await AsyncStorage.getItem('pinned_conversations');
        if (value) {
          setPinnedConversationIds(JSON.parse(value));
        }
      } catch (e) {
        // ignore
      }
    };
    loadPinned();
  }, []);

  const handleTogglePin = async (conversationId) => {
    let updated = [];
    if (pinnedConversationIds.includes(conversationId)) {
      updated = pinnedConversationIds.filter((id) => id !== conversationId);
    } else {
      updated = [...pinnedConversationIds, conversationId];
    }
    setPinnedConversationIds(updated);
    try {
      await AsyncStorage.setItem('pinned_conversations', JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  // Group creation modal states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [groupSearchText, setGroupSearchText] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupCreationStep, setGroupCreationStep] = useState(1);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [selectedAvatarImage, setSelectedAvatarImage] = useState(null);
  const [pendingImageAction, setPendingImageAction] = useState(null);

  // Join group by code/link states
  const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
  const [joinGroupInput, setJoinGroupInput] = useState('');

  const handlePickGroupAvatar = () => {
    Alert.alert(
      'Chọn ảnh đại diện nhóm',
      'Chọn phương thức để lấy ảnh',
      [
        {
          text: 'Chụp ảnh mới',
          onPress: () => {
            if (Platform.OS === 'ios') {
              setPendingImageAction('camera');
              setShowCreateGroupModal(false);
            } else {
              processGroupImagePick('camera');
            }
          }
        },
        {
          text: 'Chọn từ thư viện',
          onPress: () => {
            if (Platform.OS === 'ios') {
              setPendingImageAction('library');
              setShowCreateGroupModal(false);
            } else {
              processGroupImagePick('library');
            }
          }
        },
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
    } finally {
      setPendingImageAction(null);
      if (Platform.OS === 'ios') {
        setShowCreateGroupModal(true);
      }
    }
  };

  const loadMutualFriends = async () => {
    setLoadingFriends(true);
    try {
      const res = await getMutualFriendsRequest(token);
      setMutualFriends(res.data || []);
    } catch (err) {
      console.error('Fetch mutual friends error:', err);
      Alert.alert('Lỗi', 'Không thể tải danh sách gợi ý.');
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleOpenCreateGroup = () => {
    setShowCreateGroupModal(true);
    loadMutualFriends();
    setGroupCreationStep(1);
    setSelectedUserIds([]);
    setGroupSearchText('');
    setGroupName('');
    setSelectedAvatarImage(null);
  };

  const handleToggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredFriends = React.useMemo(() => {
    const keyword = groupSearchText.trim().toLowerCase();
    return mutualFriends.filter((friend) => {
      if (!keyword) return true;
      return friend.name?.toLowerCase().includes(keyword);
    });
  }, [mutualFriends, groupSearchText]);

  const handleNextStep = () => {
    if (selectedUserIds.length >= 2) {
      setGroupCreationStep(2);
    }
  };

  const handleStartSingleChat = async (userId) => {
    setShowCreateGroupModal(false);
    try {
      const result = await dispatch(openConversation(userId)).unwrap();
      navigation.navigate('ChatDetail', {
        conversationId: result.data._id,
        peer: result.data.peer,
      });
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể tạo cuộc trò chuyện');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUserIds.length < 2) return;
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
          console.error('Lỗi upload avatar lúc tạo nhóm:', uploadErr);
          Alert.alert('Thông báo', 'Đã tạo nhóm trò chuyện nhưng không thể tải lên ảnh đại diện.');
        }
      }

      setShowCreateGroupModal(false);
      navigation.navigate('ChatDetail', {
        conversationId: newConv._id,
        peer: newConv.peer,
        isGroup: true,
      });
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể tạo nhóm trò chuyện');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleJoinGroupByCode = () => {
    const input = joinGroupInput.trim();
    if (!input) {
      Alert.alert('Thông báo', 'Vui lòng nhập mã hoặc liên kết mời.');
      return;
    }

    // Extract code from link if they pasted a full link
    // vibesport://chat/invite/<inviteCode>
    const regex = /chat\/invite\/([a-fA-F0-9]+)/i;
    const match = input.match(regex);
    const code = match ? match[1] : input;

    // Close modal and clear input
    setShowJoinGroupModal(false);
    setJoinGroupInput('');

    // Navigate to JoinGroup screen
    navigation.navigate('JoinGroup', { code });
  };

  const renderFriendItem = ({ item }) => {
    const isSelected = selectedUserIds.includes(item._id);
    const displayName = item.name || 'Thành viên VibeSport';
    const avatarColor = getAvatarColor(displayName);

    return (
      <TouchableOpacity
        style={styles.friendItem}
        activeOpacity={0.8}
        onPress={() => handleToggleSelectUser(item._id)}
      >
        {item.picture ? (
          <Image source={{ uri: fixMediaUrl(item.picture) }} style={styles.friendAvatar} />
        ) : (
          <View style={[styles.friendAvatarFallback, { backgroundColor: avatarColor }]}>
            <Text style={styles.friendAvatarText}>{getInitials(displayName)}</Text>
          </View>
        )}
        <Text style={styles.friendName} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  const loadData = useCallback(() => {
    dispatch(fetchConversations());
    dispatch(fetchChatUnreadCount());
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const applyFilter = useCallback(
    (items) => {
      return items.filter((item) => {
        if (activeFilter === 'Chưa đọc') return item.unreadCount > 0;
        if (activeFilter === 'Chưa trả lời')
          return item.isPending && item.myPendingCount > 0 && !item.isFriend;
        return true;
      });
    },
    [activeFilter]
  );

  const allConversations = React.useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return conversations.filter((item) => {
      if (!keyword) return true;
      const peerName = item.peer?.name || 'Thành viên VibeSport';
      const lastMessage = item.lastMessage || '';
      return (
        peerName.toLowerCase().includes(keyword) ||
        lastMessage.toLowerCase().includes(keyword)
      );
    });
  }, [conversations, searchText]);

  // DEBUG: Log all conversations removed to keep console clean

  const inboxConversations = React.useMemo(() => {
    const filtered = applyFilter(
      allConversations.filter((item) => !item.isHidden && !item.hasOtherPendingRequest)
    );
    return [...filtered].sort((a, b) => {
      const aPinned = pinnedConversationIds.includes(a._id);
      const bPinned = pinnedConversationIds.includes(b._id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [allConversations, applyFilter, pinnedConversationIds]);

  const pendingConversations = React.useMemo(() => {
    return applyFilter(
      allConversations.filter(
        (item) =>
          item.hasOtherPendingRequest &&
          !item.blockedByMe
      )
    );
  }, [allConversations, applyFilter]);

  const blockedConversations = React.useMemo(() => {
    return allConversations.filter((item) => item.blockedByMe);
  }, [allConversations]);

  const activeData =
    activeTab === 'inbox'
      ? inboxConversations
      : activeTab === 'requests'
        ? pendingConversations
        : blockedConversations;

  const handleUnblock = async (item) => {
    setUnblockingId(item._id);
    try {
      await dispatch(unblockConversation(item._id)).unwrap();
      await dispatch(fetchConversations()).unwrap();

      // Check conversation - if has pending from other, go to requests, otherwise inbox
      if (item.hasOtherPendingRequest) {
        setActiveTab('requests');
      } else {
        setActiveTab('inbox');
      }
    } catch (e) {
      // handle error silently
    } finally {
      setUnblockingId(null);
    }
  };

  const handleDeleteConversation = (item) => {
    Alert.alert(
      'Xóa cuộc trò chuyện',
      `Bạn có chắc muốn xóa cuộc trò chuyện với ${item.peer?.name || 'thành viên này'} không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting conversation:', item._id);
              await dispatch(deleteConversation(item._id)).unwrap();
              await dispatch(fetchConversations()).unwrap();
            } catch (e) {
              console.error('Delete error:', e);
              Alert.alert('Lỗi', 'Không thể xóa cuộc trò chuyện');
            }
          },
        },
      ]
    );
  };

  const handleAcceptConversation = (item) => {
    Alert.alert(
      'Chấp nhận yêu cầu',
      `Bạn có muốn nhận tin nhắn từ ${item.peer?.name || 'người này'} không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Chấp nhận',
          onPress: async () => {
            try {
              console.log('Accepting conversation:', item._id);
              await dispatch(acceptConversation(item._id)).unwrap();
              await dispatch(fetchConversations()).unwrap();
            } catch (e) {
              console.error('Accept error:', e);
              Alert.alert('Lỗi', 'Không thể chấp nhận yêu cầu');
            }
          },
        },
      ]
    );
  };

  const handleBlockConversation = (item) => {
    Alert.alert(
      'Chặn người dùng',
      `Bạn có muốn chặn ${item.peer?.name || 'người này'} không? Họ sẽ không thể nhắn tin cho bạn.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Chặn',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Blocking conversation:', item._id);
              await dispatch(blockConversation(item._id)).unwrap();
              await dispatch(fetchConversations()).unwrap();
            } catch (e) {
              console.error('Block error:', e);
              Alert.alert('Lỗi', 'Không thể chặn người dùng');
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = (item) => {
    Alert.alert(
      'Rời nhóm',
      `Bạn có chắc chắn muốn rời nhóm "${item.peer?.name || 'này'}" không? Bạn sẽ không còn nhận tin nhắn từ nhóm này nữa.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Leaving group:', item._id);
              await dispatch(leaveGroup(item._id)).unwrap();
              await dispatch(fetchConversations()).unwrap();
            } catch (e) {
              console.error('Leave group error:', e);
              Alert.alert('Lỗi', e.message || 'Không thể rời nhóm');
            }
          },
        },
      ]
    );
  };

  const handleToggleMute = (item) => {
    Alert.alert(
      item.isMuted ? 'Bật thông báo' : 'Tắt thông báo',
      `Bạn có muốn ${item.isMuted ? 'bật' : 'tắt'} thông báo từ ${item.peer?.name || 'thành viên này'} không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: item.isMuted ? 'Bật' : 'Tắt',
          onPress: async () => {
            try {
              console.log('Toggle mute:', item._id, 'isMuted:', item.isMuted);
              if (item.isMuted) {
                await dispatch(unmuteConversation(item._id)).unwrap();
              } else {
                await dispatch(muteConversation(item._id)).unwrap();
              }
              await dispatch(fetchConversations()).unwrap();
            } catch (e) {
              console.error('Mute error:', e);
              Alert.alert('Lỗi', 'Không thể cập nhật thông báo');
            }
          },
        },
      ]
    );
  };

  const openChat = (item) => {
    navigation.navigate('ChatDetail', {
      conversationId: item._id,
      peer: item.peer,
      isGroup: item.isGroup,
    });
  };

  const renderConversationItem = ({ item }) => {
    const peer = item.peer;
    const peerName = peer?.name || 'Thành viên VibeSport';
    const isPending = item.isPending && !item.blockedByMe;
    const hasOtherPendingMessages = (item.otherPendingMessages?.length || 0) > 0;

    const cleanLastMessage = (text) => {
      if (!text) return '';
      if (
        text.includes('ðŸ') ||
        text.includes('ðŸ–¼ï¸') ||
        text.includes('ð¼ï') ||
        text.includes('ð') ||
        text.startsWith('ð') ||
        text === '📷 Ảnh'
      ) {
        return '[Hình ảnh]';
      }
      return text;
    };

    const currentUserId = user?.id || user?._id;
    const lastSenderId = item.lastMessageSenderId?._id || item.lastMessageSenderId;
    const isLastMessageSentByMe =
      lastSenderId &&
      currentUserId &&
      String(lastSenderId) === String(currentUserId);

    const getLastMessageSenderName = () => {
      if (!lastSenderId || isPending) return '';
      if (isLastMessageSentByMe) return 'Bạn';
      if (!item.isGroup) return '';
      
      const sender = (item.participants || []).find(
        (p) => String(p._id || p) === String(lastSenderId)
      );
      if (sender) {
        const fullName = sender.name || 'Thành viên';
        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1];
      }
      return '';
    };

    const senderPrefix = getLastMessageSenderName();
    const prefix = senderPrefix ? `${senderPrefix}: ` : '';

    const subtitle = isPending
      ? (hasOtherPendingMessages
          ? cleanLastMessage(item.otherPendingMessages?.[0]?.content) || 'Tin nhắn chờ xác nhận'
          : 'Chờ bạn chấp nhận')
      : item.lastMessage
        ? `${prefix}${cleanLastMessage(item.lastMessage)}`
        : 'Bắt đầu trò chuyện';
    const subtitleColor = isPending ? '#0b74ff' : '#6B7280';
    const unreadCount = item.unreadCount || 0;

    return (
      <View style={styles.conversationItem}>
        <TouchableOpacity
          style={styles.conversationItemTouchable}
          activeOpacity={0.85}
          onPress={() => openChat(item)}
          onLongPress={() => {
            if (!isPending) {
              setSelectedConversation(item);
              setShowOptionsModal(true);
            }
          }}
        >
          {renderConversationAvatar(item)}

          <View style={styles.conversationBody}>
            <View style={styles.conversationTopRow}>
              <Text
                style={[
                  styles.peerName,
                  unreadCount > 0 && styles.peerNameUnread,
                ]}
                numberOfLines={1}
              >
                {peerName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {pinnedConversationIds.includes(item._id) && (
                  <Ionicons name="pin" size={12} color="#94A3B8" style={{ transform: [{ rotate: '45deg' }] }} />
                )}
                <Text style={styles.timeText}>{formatTime(item.lastMessageAt)}</Text>
              </View>
            </View>
            <View style={styles.conversationBottomRow}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                {isPending && <View style={styles.pendingDot} />}
                <Text
                  style={[
                    styles.lastMessage,
                    unreadCount > 0 && styles.lastMessageUnread,
                    { color: subtitleColor },
                  ]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadDot} />
                )}
              </View>
              {!isPending && (
                <TouchableOpacity
                  style={styles.moreOptionsBtn}
                  onPress={() => {
                    setSelectedConversation(item);
                    setShowOptionsModal(true);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {isPending ? (
          <View style={styles.itemActions}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleAcceptConversation(item)}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#10B981" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleDeleteConversation(item)}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleBlockConversation(item)}
            >
              <Ionicons name="hand-right-outline" size={20} color="#F59E0B" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const renderBlockedItem = ({ item }) => {
    const peer = item.peer;
    const peerName = peer?.name || 'Thành viên VibeSport';
    const isUnblocking = unblockingId === item._id;

    return (
      <View style={styles.conversationItem}>
        <TouchableOpacity
          style={styles.conversationItemTouchable}
          activeOpacity={0.85}
          onPress={() => openChat(item)}
        >
          {renderConversationAvatar(item)}

          <View style={styles.conversationBody}>
            <View style={styles.conversationTopRow}>
              <Text style={styles.peerName} numberOfLines={1}>
                {peerName}
              </Text>
              <Ionicons name="ban" size={14} color="#DC2626" />
            </View>
            <View style={styles.conversationBottomRow}>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {cleanLastMessage(item.lastMessage)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.unblockButton, { marginRight: 12 }]}
          onPress={() => handleUnblock(item)}
          disabled={isUnblocking}
          activeOpacity={0.7}
        >
          {isUnblocking ? (
            <ActivityIndicator size="small" color="#0b74ff" />
          ) : (
            <Text style={styles.unblockButtonText}>Bỏ chặn</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyInbox = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="chatbubbles-outline" size={52} color="#D1D5DB" />
      </View>
      <Text style={styles.emptyTitle}>Tin nhắn</Text>
      <Text style={styles.emptySubtitle}>
        Gửi tin nhắn cho bạn bè hoặc người theo dõi để bắt đầu trò chuyện.
      </Text>
    </View>
  );

  const renderEmptyPending = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="mail-outline" size={52} color="#D1D5DB" />
      </View>
      <Text style={styles.emptyTitle}>Không có yêu cầu</Text>
      <Text style={styles.emptySubtitle}>
        Khi ai đó muốn nhắn tin với bạn, yêu cầu sẽ xuất hiện ở đây.
      </Text>
    </View>
  );

  const renderEmptyBlocked = () => (
    <View style={styles.emptyBlockedState}>
      <Ionicons name="ban-outline" size={32} color="#D1D5DB" />
      <Text style={styles.emptyBlockedText}>Không có tin nhắn bị chặn</Text>
    </View>
  );

  const renderItem =
    activeTab === 'blocked' ? renderBlockedItem : renderConversationItem;
  const emptyComponent =
    activeTab === 'inbox'
      ? renderEmptyInbox
      : activeTab === 'requests'
        ? renderEmptyPending
        : renderEmptyBlocked;

  return (
    <Screen style={styles.screen}>
      <View style={styles.logoHeaderCard}>
        {isSearching ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity
              onPress={() => {
                setIsSearching(false);
                setSearchText('');
              }}
              style={{ marginRight: 8, padding: 4 }}
            >
              <Ionicons name="arrow-back-outline" size={24} color="#000000" />
            </TouchableOpacity>
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Tìm kiếm..."
              placeholderTextColor="#8E8E8E"
              autoFocus
              style={{
                flex: 1,
                fontSize: 16,
                color: '#000000',
                paddingVertical: 4,
              }}
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchText('')}
                style={{ padding: 4 }}
              >
                <Ionicons name="close-circle" size={20} color="#8E8E8E" />
              </TouchableOpacity>
            )}
          </View>
        ) : activeTab === 'inbox' ? (
          <>
            <View style={styles.logoHeaderLeft}>
              <Image
                source={require('../../assets/logosp.png')}
                style={styles.logoHeaderImage}
                resizeMode="contain"
              />
              <Text style={styles.logoHeaderText}>
                Tin<Text style={{ color: color.FF6B3D }}>Nhắn</Text>
              </Text>
            </View>

            <View style={styles.logoHeaderRight}>
              <TouchableOpacity
                style={styles.logoHeaderIconBtn}
                onPress={() => setIsSearching(true)}
              >
                <Ionicons name="search-outline" size={20} color="#000000" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoHeaderIconBtn}
                onPress={() => setShowHeaderMenu(true)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#000000" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoHeaderIconBtn}
                onPress={() => navigation.navigate('Notification')}
              >
                <View style={{ position: 'relative' }}>
                  <Ionicons name="notifications-outline" size={20} color="#000000" />
                  {unreadNotificationCount > 0 && (
                    <View style={styles.bellRedDot} />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.logoHeaderLeft}>
              <TouchableOpacity
                style={{ marginRight: 12, padding: 4 }}
                onPress={() => setActiveTab('inbox')}
              >
                <Ionicons name="arrow-back-outline" size={24} color="#000000" />
              </TouchableOpacity>
              <Text style={styles.logoHeaderText}>
                {activeTab === 'requests' ? 'Yêu cầu tin nhắn' : 'Tin nhắn bị chặn'}
              </Text>
            </View>
          </>
        )}
      </View>

      {loadingConversations && activeData.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0b74ff" />
        </View>
      ) : (
        <FlatList
          data={activeData}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={loadingConversations}
              onRefresh={loadData}
              tintColor="#0b74ff"
            />
          }
          contentContainerStyle={
            activeData.length === 0 ? styles.emptyList : styles.listContent
          }
          ListEmptyComponent={emptyComponent}
        />
      )}

      <Modal
        visible={showFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilter(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowFilter(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.filterPopup}>
                <View style={styles.filterHeader}>
                  <Text style={styles.filterTitle}>Bộ lọc</Text>
                  <TouchableOpacity onPress={() => setShowFilter(false)}>
                    <Ionicons name="close" size={20} color="#262626" />
                  </TouchableOpacity>
                </View>
                {FILTERS.map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={styles.filterOption}
                    activeOpacity={0.7}
                    onPress={() => {
                      setActiveFilter(filter);
                      setShowFilter(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        activeFilter === filter && styles.filterOptionTextActive,
                      ]}
                    >
                      {filter}
                    </Text>
                    {activeFilter === filter && (
                      <Ionicons name="checkmark" size={18} color="#0b74ff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showOptionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowOptionsModal(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuContainer}>
                <View style={styles.menuHandle} />

                <Text style={styles.menuTitle} numberOfLines={1}>
                  Tùy chọn đoạn chat
                </Text>

                {selectedConversation && !selectedConversation.isGroup && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setShowOptionsModal(false);
                      const peerId = selectedConversation.peer?._id || selectedConversation.peer?.id;
                      if (peerId) {
                        navigation.navigate('UserProfile', { userId: peerId });
                      }
                    }}
                  >
                    <Ionicons name="person-outline" size={22} color="#374151" />
                    <Text style={styles.menuItemText}>Xem trang cá nhân</Text>
                  </TouchableOpacity>
                )}

                {selectedConversation && selectedConversation.isGroup && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setShowOptionsModal(false);
                      navigation.navigate('ChatDetail', { conversationId: selectedConversation._id });
                    }}
                  >
                    <Ionicons name="people-outline" size={22} color="#374151" />
                    <Text style={styles.menuItemText}>Xem thông tin nhóm</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    styles.menuItemBorder
                  ]}
                  onPress={() => {
                    setShowOptionsModal(false);
                    handleTogglePin(selectedConversation?._id);
                  }}
                >
                  <Ionicons
                    name={pinnedConversationIds.includes(selectedConversation?._id) ? 'pin' : 'pin-outline'}
                    size={22}
                    color="#374151"
                  />
                  <Text style={styles.menuItemText}>
                    {pinnedConversationIds.includes(selectedConversation?._id) ? 'Bỏ ghim' : 'Ghim'}
                  </Text>
                </TouchableOpacity>

                {selectedConversation && !selectedConversation.isGroup && (
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuItemBorder]}
                    onPress={() => {
                      setShowOptionsModal(false);
                      const phone = selectedConversation.peer?.phone || selectedConversation.peer?.phoneNumber;
                      if (phone) {
                        Linking.openURL(`tel:${phone}`);
                      } else {
                        Alert.alert('Gọi điện', 'Người dùng này chưa cập nhật số điện thoại.');
                      }
                    }}
                  >
                    <Ionicons name="call-outline" size={22} color="#374151" />
                    <Text style={styles.menuItemText}>Gọi điện</Text>
                  </TouchableOpacity>
                )}

                {selectedConversation && selectedConversation.isGroup && (
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuItemBorder]}
                    onPress={() => {
                      setShowOptionsModal(false);
                      Alert.alert('Gọi nhóm', 'Tính năng gọi thoại nhóm đang được phát triển.');
                    }}
                  >
                    <Ionicons name="call-outline" size={22} color="#374151" />
                    <Text style={styles.menuItemText}>Gọi nhóm</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemBorder]}
                  onPress={() => {
                    setShowOptionsModal(false);
                    handleToggleMute(selectedConversation);
                  }}
                >
                  <Ionicons
                    name={selectedConversation?.isMuted ? 'notifications' : 'notifications-off-outline'}
                    size={22}
                    color="#374151"
                  />
                  <Text style={styles.menuItemText}>
                    {selectedConversation?.isMuted ? 'Bật thông báo' : 'Tắt thông báo'}
                  </Text>
                </TouchableOpacity>

                {selectedConversation && !selectedConversation.isGroup && (
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuItemBorder]}
                    onPress={() => {
                      setShowOptionsModal(false);
                      handleBlockConversation(selectedConversation);
                    }}
                  >
                    <Ionicons name="ban-outline" size={22} color="#374151" />
                    <Text style={styles.menuItemText}>Chặn</Text>
                  </TouchableOpacity>
                )}

                {selectedConversation && selectedConversation.isGroup && (
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuItemBorder]}
                    onPress={() => {
                      setShowOptionsModal(false);
                      handleLeaveGroup(selectedConversation);
                    }}
                  >
                    <Ionicons name="log-out-outline" size={22} color="#374151" />
                    <Text style={styles.menuItemText}>Rời nhóm</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemBorder]}
                  onPress={() => {
                    setShowOptionsModal(false);
                    handleDeleteConversation(selectedConversation);
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                  <Text style={[styles.menuItemText, styles.menuItemDanger]}>Xóa đoạn chat</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showCreateGroupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateGroupModal(false)}
        onDismiss={() => {
          if (Platform.OS === 'ios' && pendingImageAction) {
            processGroupImagePick(pendingImageAction);
          }
        }}
      >
        <View style={styles.groupModalOverlay}>
          <View style={styles.groupModalContainer}>
            {groupCreationStep === 1 ? (
              <>
                <View style={styles.groupModalHeader}>
                  <TouchableOpacity onPress={() => setShowCreateGroupModal(false)}>
                    <Text style={styles.cancelBtnText}>Hủy</Text>
                  </TouchableOpacity>
                  <Text style={styles.groupModalTitle}>Nhóm mới</Text>
                  <TouchableOpacity
                    onPress={handleNextStep}
                    disabled={selectedUserIds.length < 2}
                  >
                    <Text
                      style={[
                        styles.nextBtnText,
                        selectedUserIds.length < 2 && styles.nextBtnTextDisabled,
                      ]}
                    >
                      Tiếp
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSearchWrap}>
                  <View style={styles.modalSearchBar}>
                    <Ionicons name="search" size={16} color="#8E8E93" />
                    <TextInput
                      value={groupSearchText}
                      onChangeText={setGroupSearchText}
                      placeholder="Tìm kiếm"
                      placeholderTextColor="#8E8E93"
                      style={styles.modalSearchInput}
                    />
                  </View>
                </View>

                <Text style={styles.suggestionTitle}>Gợi ý</Text>
                {loadingFriends ? (
                  <View style={styles.modalLoadingWrap}>
                    <ActivityIndicator size="small" color="#0A84FF" />
                  </View>
                ) : (
                  <FlatList
                    data={filteredFriends}
                    keyExtractor={(item) => item._id || item.id}
                    renderItem={renderFriendItem}
                    contentContainerStyle={styles.friendsList}
                    ListEmptyComponent={
                      <Text style={styles.emptyFriendsText}>
                        Không tìm thấy người dùng phù hợp
                      </Text>
                    }
                  />
                )}
              </>
            ) : (
              <>
                <View style={styles.groupModalHeader}>
                  <TouchableOpacity onPress={() => setGroupCreationStep(1)}>
                    <Text style={styles.cancelBtnText}>Quay lại</Text>
                  </TouchableOpacity>
                  <Text style={styles.groupModalTitle}>Tên nhóm</Text>
                  <TouchableOpacity
                    onPress={handleCreateGroup}
                    disabled={creatingGroup || !groupName.trim()}
                  >
                    {creatingGroup ? (
                      <ActivityIndicator size="small" color="#0A84FF" />
                    ) : (
                      <Text
                        style={[
                          styles.nextBtnText,
                          !groupName.trim() && styles.nextBtnTextDisabled,
                        ]}
                      >
                        Tạo
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.groupCreationBody}>
                  <TouchableOpacity
                    onPress={handlePickGroupAvatar}
                    style={styles.groupAvatarPicker}
                    activeOpacity={0.8}
                  >
                    {selectedAvatarImage ? (
                      <Image source={{ uri: selectedAvatarImage.uri }} style={styles.groupAvatarPreview} />
                    ) : (
                      <View style={styles.groupAvatarPreviewFallback}>
                        <Ionicons name="camera" size={32} color="#8E8E93" />
                        <Text style={styles.groupAvatarFallbackText}>Thêm ảnh</Text>
                      </View>
                    )}
                    {selectedAvatarImage && (
                      <View style={styles.groupAvatarBadge}>
                        <Ionicons name="camera" size={14} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.groupNameContainer}>
                    <TextInput
                      value={groupName}
                      onChangeText={setGroupName}
                      placeholder="Nhập tên nhóm..."
                      placeholderTextColor="#8E8E93"
                      style={styles.groupNameInput}
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

      <Modal
        visible={showJoinGroupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJoinGroupModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowJoinGroupModal(false)}>
          <View style={styles.groupModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.groupModalContainer, { height: 'auto', paddingBottom: 24 }]}>
                <View style={styles.groupModalHeader}>
                  <TouchableOpacity onPress={() => setShowJoinGroupModal(false)}>
                    <Text style={styles.cancelBtnText}>Hủy</Text>
                  </TouchableOpacity>
                  <Text style={styles.groupModalTitle}>Tham gia bằng mã</Text>
                  <TouchableOpacity onPress={handleJoinGroupByCode}>
                    <Text style={styles.nextBtnText}>Xong</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={{ padding: 20 }}>
                  <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 12, lineHeight: 20 }}>
                    Nhập mã mời nhóm (ví dụ: abc123xy) hoặc dán toàn bộ liên kết mời nhóm vào ô dưới đây.
                  </Text>
                  
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    backgroundColor: '#F8FAFC',
                    height: 50,
                  }}>
                    <Ionicons name="link" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
                    <TextInput
                      value={joinGroupInput}
                      onChangeText={setJoinGroupInput}
                      placeholder="Mã hoặc đường dẫn mời nhóm..."
                      placeholderTextColor="#94A3B8"
                      style={{
                        flex: 1,
                        fontSize: 15,
                        color: '#1E293B',
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showHeaderMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHeaderMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowHeaderMenu(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuContainer}>
                <View style={styles.menuHandle} />

                <Text style={styles.menuTitle}>Tùy chọn tin nhắn</Text>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowHeaderMenu(false);
                    setActiveTab('requests');
                  }}
                >
                  <Ionicons name="chatbox-ellipses-outline" size={22} color="#374151" />
                  <Text style={styles.menuItemText}>Yêu cầu</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemBorder]}
                  onPress={() => {
                    setShowHeaderMenu(false);
                    handleOpenCreateGroup();
                  }}
                >
                  <Ionicons name="people-outline" size={22} color="#374151" />
                  <Text style={styles.menuItemText}>Tạo nhóm</Text>
                </TouchableOpacity>


                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemBorder]}
                  onPress={() => {
                    setShowHeaderMenu(false);
                    setActiveTab('blocked');
                  }}
                >
                  <Ionicons name="ban-outline" size={22} color="#EF4444" />
                  <Text style={[styles.menuItemText, styles.menuItemDanger]}>Đã chặn</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  logoHeaderCard: {
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
  logoHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoHeaderImage: {
    width: 44,
    height: 44,
    marginRight: -6,
  },
  logoHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  logoHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: -2,
  },
  logoHeaderIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellRedDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF0000',
  },
  header: {
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
  headerLeftBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTabs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTab: {
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  headerTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E8E',
  },
  headerTabTextActive: {
    color: '#262626',
    fontWeight: '700',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ED4956',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeRed: {
    backgroundColor: '#DC2626',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#DBDBDB',
    backgroundColor: '#FAFAFA',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#262626',
    padding: 0,
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 30,
  },
  emptyList: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    marginHorizontal: 9,
    marginVertical: 6,
    height: 78,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 0,
    elevation: 4,
  },
  conversationItemTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  actionIconBtn: {
    padding: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFEFEF',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  groupAvatarGrid: {
    width: 56,
    height: 56,
    position: 'relative',
  },
  groupAvatarItem: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  groupAvatarItemText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  conversationBody: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  conversationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  peerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
    flex: 1,
  },
  peerNameUnread: {
    fontWeight: '800',
  },
  timeText: {
    fontSize: 12,
    color: '#8E8E8E',
  },
  conversationBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0b74ff',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#8E8E8E',
    lineHeight: 18,
  },
  lastMessageUnread: {
    fontWeight: '600',
    color: '#262626',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginLeft: 6,
    marginRight: 6,
    alignSelf: 'center',
  },
  moreOptionsBtn: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedLabel: {
    fontSize: 14,
    color: '#DC2626',
  },
  unblockButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBDBDB',
    minWidth: 80,
    alignItems: 'center',
  },
  unblockButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#262626',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyIconWrap: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#262626',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E8E',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBlockedState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  emptyBlockedText: {
    fontSize: 14,
    color: '#8E8E8E',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPopup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '80%',
    maxWidth: 300,
    overflow: 'hidden',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#DBDBDB',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#262626',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  filterOptionText: {
    fontSize: 15,
    color: '#262626',
  },
  filterOptionTextActive: {
    fontWeight: '700',
    color: '#0b74ff',
  },
  groupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  groupModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    height: '90%',
    paddingBottom: 20,
  },
  groupModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#DBDBDB',
  },
  cancelBtnText: {
    color: '#0b74ff',
    fontSize: 16,
    fontWeight: '400',
  },
  groupModalTitle: {
    color: '#262626',
    fontSize: 17,
    fontWeight: '600',
  },
  nextBtnText: {
    color: '#0b74ff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextBtnTextDisabled: {
    color: '#C7C7C7',
  },
  modalSearchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    color: '#262626',
    fontSize: 15,
    padding: 0,
  },
  suggestionTitle: {
    color: '#8E8E8E',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
  },
  modalLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  friendsList: {
    paddingBottom: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFEFEF',
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
    fontSize: 16,
    fontWeight: '700',
  },
  friendName: {
    flex: 1,
    color: '#262626',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DBDBDB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: '#0b74ff',
    borderColor: '#0b74ff',
  },
  emptyFriendsText: {
    color: '#8E8E8E',
    textAlign: 'center',
    fontSize: 14,
    paddingTop: 40,
  },
  groupNameContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    width: '100%',
  },
  groupNameInput: {
    color: '#262626',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DBDBDB',
    paddingVertical: 8,
    textAlign: 'center',
  },
  groupCreationBody: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
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
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarFallbackText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '600',
  },
  groupAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0b74ff',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingTop: 8,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
  },
  menuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
  },
  menuItemDanger: {
    color: '#EF4444',
  },
  menuCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
});
