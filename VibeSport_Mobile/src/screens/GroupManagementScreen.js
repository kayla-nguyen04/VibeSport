import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  Share,
  Clipboard,
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
  leaveGroup,
  removeParticipant,
  openConversation,
  generateInviteLink,
  revokeInviteLink,
  updateMemberRole,
  muteMember,
  unmuteMember,
  updateNickname,
  approveJoinRequest,
  rejectJoinRequest,
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
  const [pendingImageAction, setPendingImageAction] = useState(null);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'admin'
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  // Duyệt thành viên chờ vào nhóm
  const [showJoinRequestsModal, setShowJoinRequestsModal] = useState(false);
  const [processingJoinRequest, setProcessingJoinRequest] = useState(null); // userId đang xử lý

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  const addMemberBackdropOpacity = useRef(new Animated.Value(0)).current;
  const addMemberSlideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (showOptionsModal) {
      backdropOpacity.setValue(0);
      slideAnim.setValue(300);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [showOptionsModal]);

  useEffect(() => {
    if (showAddMemberModal) {
      addMemberBackdropOpacity.setValue(0);
      addMemberSlideAnim.setValue(500);
      Animated.parallel([
        Animated.timing(addMemberBackdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(addMemberSlideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [showAddMemberModal]);

  const handleCloseOptions = (callback) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      setShowOptionsModal(false);
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  const handleCloseAddMember = (callback) => {
    Animated.parallel([
      Animated.timing(addMemberBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(addMemberSlideAnim, {
        toValue: 500,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      setShowAddMemberModal(false);
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  const handleOpenEditGroup = () => {
    setNewGroupName(peerName);
    setSelectedAvatarImage(null);
    setShowEditGroupModal(true);
  };

  const isCurrentUserAdmin = useMemo(() => {
    if (conversationMeta && 'isAdmin' in conversationMeta) {
      return conversationMeta.isAdmin;
    }
    const adminId = conversationMeta?.admin || conversationMeta?.participants?.[0]?._id || conversationMeta?.participants?.[0];
    return String(adminId?._id || adminId) === String(currentUserId);
  }, [conversationMeta, currentUserId]);

  const isCurrentUserCoAdmin = useMemo(() => {
    if (conversationMeta && 'isCoAdmin' in conversationMeta) {
      return conversationMeta.isCoAdmin;
    }
    return (conversationMeta?.coAdmins || []).some(id => String(id._id || id) === String(currentUserId));
  }, [conversationMeta, currentUserId]);

  const isCurrentUserAdminOrCoAdmin = useMemo(() => {
    return isCurrentUserAdmin || isCurrentUserCoAdmin;
  }, [isCurrentUserAdmin, isCurrentUserCoAdmin]);

  const getMemberRole = (memberId) => {
    const mId = String(memberId);
    const adminId = conversationMeta?.admin ? String(conversationMeta.admin._id || conversationMeta.admin) : String(conversationMeta?.participants?.[0]?._id || conversationMeta?.participants?.[0]);
    if (mId === adminId) return 'admin';
    const isCo = (conversationMeta?.coAdmins || []).some(id => String(id._id || id) === mId);
    if (isCo) return 'coAdmin';
    return 'member';
  };

  const isMemberMuted = (memberId) => {
    return (conversationMeta?.mutedMembers || []).some(id => String(id._id || id) === String(memberId));
  };

  const getMemberNickname = (memberId) => {
    return conversationMeta?.nicknames?.[String(memberId)] || '';
  };

  // Nickname states
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [editingNickname, setEditingNickname] = useState('');
  const [nicknameTargetMember, setNicknameTargetMember] = useState(null);
  const [isUpdatingNickname, setIsUpdatingNickname] = useState(false);

  const isFriendSelectedMember = useMemo(() => {
    if (!selectedMember) return false;
    return mutualFriends.some((f) => String(f._id) === String(selectedMember._id));
  }, [selectedMember, mutualFriends]);

  const handleOpenOptions = (member) => {
    setSelectedMember(member);
    setShowOptionsModal(true);
  };

  const handleMessageUser = async (memberId) => {
    setShowMembersModal(false);
    setShowOptionsModal(false);
    try {
      const result = await dispatch(openConversation(memberId)).unwrap();
      navigation.navigate('ChatDetail', {
        conversationId: result.data._id,
        peer: result.data.peer,
      });
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể mở cuộc trò chuyện');
    }
  };

  const handleBlockMember = (member) => {
    handleCloseOptions(() => {
      Alert.alert(
        'Chặn người dùng',
        `Bạn có muốn chặn ${member.name} không? Họ sẽ không thể gửi tin nhắn trực tiếp cho bạn.`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Chặn',
            style: 'destructive',
            onPress: () => {
              Alert.alert('Thành công', `Đã chặn ${member.name}.`);
            }
          }
        ]
      );
    });
  };

  const handleRemoveMember = (member) => {
    handleCloseOptions(() => {
      Alert.alert(
        'Xóa khỏi nhóm',
        `Bạn có chắc chắn muốn xóa ${member.name} khỏi cuộc trò chuyện nhóm này không?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xóa',
            style: 'destructive',
            onPress: async () => {
              try {
                await dispatch(removeParticipant({ conversationId, userId: member._id })).unwrap();
                Alert.alert('Thành công', `Đã xóa ${member.name} khỏi nhóm.`);
              } catch (err) {
                Alert.alert('Lỗi', err || 'Không thể xóa thành viên');
              }
            }
          }
        ]
      );
    });
  };

  const handleAddFriend = (member) => {
    handleCloseOptions(() => {
      Alert.alert(
        'Kết bạn',
        `Gửi lời mời kết bạn đến ${member.name}?`,
        [
          { text: 'Hủy', style: 'cancel' },
          { 
            text: 'Gửi', 
            onPress: () => {
              Alert.alert('Thành công', `Đã gửi lời mời kết bạn đến ${member.name}`);
            } 
          }
        ]
      );
    });
  };

  const handleOpenNicknameModal = (member) => {
    handleCloseOptions(() => {
      setNicknameTargetMember(member);
      setEditingNickname(getMemberNickname(member._id));
      setShowNicknameModal(true);
    });
  };

  const handleSaveNickname = async () => {
    if (!nicknameTargetMember) return;
    setIsUpdatingNickname(true);
    try {
      await dispatch(updateNickname({
        conversationId,
        userId: nicknameTargetMember._id,
        nickname: editingNickname,
      })).unwrap();
      Alert.alert('Thành công', 'Cập nhật biệt danh thành công');
      setShowNicknameModal(false);
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể cập nhật biệt danh');
    } finally {
      setIsUpdatingNickname(false);
    }
  };

  const handleToggleCoAdmin = (member, currentRole) => {
    handleCloseOptions(() => {
      const newRole = currentRole === 'coAdmin' ? 'member' : 'coAdmin';
      const confirmMsg = currentRole === 'coAdmin' 
        ? `Bạn có chắc chắn muốn gỡ vai trò Admin của ${member.name}?` 
        : `Bạn có chắc chắn muốn chỉ định ${member.name} làm Admin?`;
      
      Alert.alert(
        newRole === 'coAdmin' ? 'Chỉ định làm Admin' : 'Gỡ vai trò Admin',
        confirmMsg,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xác nhận',
            onPress: async () => {
              try {
                await dispatch(updateMemberRole({
                  conversationId,
                  userId: member._id,
                  role: newRole,
                })).unwrap();
                Alert.alert('Thành công', newRole === 'coAdmin' ? 'Đã chỉ định làm Admin thành công' : 'Đã gỡ vai trò Admin thành công');
              } catch (err) {
                Alert.alert('Lỗi', err || 'Không thể thay đổi vai trò.');
              }
            }
          }
        ]
      );
    });
  };

  const handleToggleMuteMember = (member, isMuted) => {
    handleCloseOptions(() => {
      const confirmMsg = isMuted 
        ? `Bạn có muốn bỏ chặn đối với ${member.name}?` 
        : `Bạn có muốn chặn ${member.name}? Họ sẽ không thể gửi tin nhắn trong nhóm và sẽ bị chặn liên lạc với bạn.`;
      
      Alert.alert(
        isMuted ? 'Bỏ chặn thành viên' : 'Chặn thành viên',
        confirmMsg,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xác nhận',
            style: isMuted ? 'default' : 'destructive',
            onPress: async () => {
              try {
                if (isMuted) {
                  await dispatch(unmuteMember({ conversationId, userId: member._id })).unwrap();
                  Alert.alert('Thành công', 'Đã bỏ chặn thành viên.');
                } else {
                  await dispatch(muteMember({ conversationId, userId: member._id })).unwrap();
                  Alert.alert('Thành công', 'Đã chặn thành viên.');
                }
              } catch (err) {
                Alert.alert('Lỗi', err || 'Không thể thực hiện thao tác.');
              }
            }
          }
        ]
      );
    });
  };

  const handleToggleInviteLink = async () => {
    try {
      if (conversationMeta?.inviteLinkEnabled) {
        await dispatch(revokeInviteLink(conversationId)).unwrap();
        Alert.alert('Thành công', 'Đã vô hiệu hóa liên kết mời nhóm.');
      } else {
        await dispatch(generateInviteLink(conversationId)).unwrap();
        Alert.alert('Thành công', 'Đã kích hoạt liên kết mời nhóm.');
      }
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể thực hiện thao tác.');
    }
  };

  const handleCopyInviteLink = () => {
    const link = `vibesport://chat/invite/${conversationMeta?.inviteCode}`;
    Clipboard.setString(link);
    Alert.alert('Đã sao chép', 'Liên kết mời đã được sao chép vào bộ nhớ tạm.');
  };

  const handleShareInviteLink = async () => {
    try {
      const link = `vibesport://chat/invite/${conversationMeta?.inviteCode}`;
      await Share.share({
        message: `Tham gia nhóm chat "${peerName}" trên VibeSport bằng liên kết này: ${link}`,
      });
    } catch (err) {
      console.error('Lỗi chia sẻ:', err);
    }
  };

  const handleRevokeInviteLink = () => {
    Alert.alert(
      'Đặt lại liên kết',
      'Bạn có muốn hủy liên kết hiện tại và tạo liên kết mới không? Liên kết cũ sẽ không thể sử dụng được nữa.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đặt lại',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(revokeInviteLink(conversationId)).unwrap();
              await dispatch(generateInviteLink(conversationId)).unwrap();
              Alert.alert('Thành công', 'Đã làm mới liên kết mời nhóm.');
            } catch (err) {
              Alert.alert('Lỗi', err || 'Không thể đặt lại liên kết.');
            }
          }
        }
      ]
    );
  };

  const targetMemberRole = useMemo(() => {
    if (!selectedMember) return 'member';
    return getMemberRole(selectedMember._id);
  }, [selectedMember, getMemberRole]);

  const targetMemberIsMuted = useMemo(() => {
    if (!selectedMember) return false;
    return isMemberMuted(selectedMember._id);
  }, [selectedMember, isMemberMuted]);

  const canManageTarget = useMemo(() => {
    if (!selectedMember) return false;
    const targetId = String(selectedMember._id);
    const myId = String(currentUserId);
    if (targetId === myId) return false; // cannot manage myself in options

    if (isCurrentUserAdmin) return true; // creator can manage everyone
    
    // Co-admin can manage anyone except the creator
    if (isCurrentUserCoAdmin) {
      return targetMemberRole !== 'admin';
    }
    
    return false;
  }, [selectedMember, currentUserId, isCurrentUserAdmin, isCurrentUserCoAdmin, targetMemberRole]);

  const canChangeRole = useMemo(() => {
    if (!isCurrentUserAdminOrCoAdmin) return false;
    if (!selectedMember) return false;
    
    const targetId = String(selectedMember._id);
    if (targetId === String(currentUserId)) return false;

    const creatorId = conversationMeta?.admin ? String(conversationMeta.admin._id || conversationMeta.admin) : String(conversationMeta?.participants?.[0]?._id || conversationMeta?.participants?.[0]);
    if (targetId === creatorId) return false; // cannot demote creator

    return true;
  }, [isCurrentUserAdminOrCoAdmin, selectedMember, currentUserId, conversationMeta]);

  const canMuteUnmute = useMemo(() => {
    return canManageTarget;
  }, [canManageTarget]);

  const canRemove = useMemo(() => {
    return canManageTarget;
  }, [canManageTarget]);

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
        {
          text: 'Chụp ảnh mới',
          onPress: () => {
            if (Platform.OS === 'ios') {
              setPendingImageAction('camera');
              setShowEditGroupModal(false);
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
              setShowEditGroupModal(false);
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
        setShowEditGroupModal(true);
      }
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
      handleCloseAddMember();
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể thêm thành viên');
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Rời khỏi cuộc trò chuyện',
      'Bạn có chắc chắn muốn rời khỏi cuộc trò chuyện nhóm này không? Bạn sẽ không thể nhận được tin nhắn mới từ nhóm này nữa.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(leaveGroup(conversationId)).unwrap();
              Alert.alert('Thành công', 'Bạn đã rời khỏi nhóm.');
              navigation.navigate('Home', { activeTab: 'social' });
            } catch (err) {
              Alert.alert('Lỗi', err || 'Không thể rời khỏi nhóm');
            }
          }
        }
      ]
    );
  };

  const handleApproveJoinRequest = async (userId) => {
    setProcessingJoinRequest(userId);
    try {
      await dispatch(approveJoinRequest({ conversationId, userId })).unwrap();
      Alert.alert('Thành công', 'Đã phê duyệt thành viên vào nhóm.');
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể phê duyệt thành viên');
    } finally {
      setProcessingJoinRequest(null);
    }
  };

  const handleRejectJoinRequest = (userId, userName) => {
    Alert.alert(
      'Từ chối yêu cầu',
      `Bạn có chắc muốn từ chối yêu cầu của ${userName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: async () => {
            setProcessingJoinRequest(userId);
            try {
              await dispatch(rejectJoinRequest({ conversationId, userId })).unwrap();
            } catch (err) {
              Alert.alert('Lỗi', err || 'Không thể từ chối yêu cầu');
            } finally {
              setProcessingJoinRequest(null);
            }
          },
        },
      ]
    );
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
    if (!conversationMeta) return [];
    const adminId = conversationMeta.admin?._id || conversationMeta.admin || conversationMeta.participants?.[0]?._id || conversationMeta.participants?.[0];
    const foundAdmin = conversationMeta.participants?.find(p => String(p._id || p) === String(adminId));
    return foundAdmin ? [foundAdmin] : [];
  }, [conversationMeta]);

  const coAdmins = useMemo(() => {
    if (!conversationMeta) return [];
    const coAdminIds = (conversationMeta.coAdmins || []).map(c => String(c._id || c));
    return conversationMeta.participants?.filter(p => coAdminIds.includes(String(p._id || p))) || [];
  }, [conversationMeta]);

  const memberListData = useMemo(() => {
    if (activeTab === 'admin') {
      const data = [];
      admins.forEach((item) => {
        data.push({ type: 'member', data: item, role: 'admin' });
      });
      coAdmins.forEach((item) => {
        data.push({ type: 'member', data: item, role: 'coAdmin' });
      });
      return data;
    }

    const data = [];
    const adminId = conversationMeta?.admin?._id || conversationMeta?.admin || conversationMeta?.participants?.[0]?._id || conversationMeta?.participants?.[0];
    const coAdminIds = (conversationMeta?.coAdmins || []).map(c => String(c._id || c));

    if (friendsInGroup.length > 0) {
      data.push({ type: 'header', title: 'Bạn bè', hasSeeAll: true });
      friendsInGroup.forEach((item) => {
        const mId = String(item._id || item);
        const role = mId === String(adminId) ? 'admin' : (coAdminIds.includes(mId) ? 'coAdmin' : 'member');
        data.push({ type: 'member', data: item, isFriend: true, role });
      });
    }

    if (othersInGroup.length > 0) {
      data.push({ type: 'header', title: 'Thành viên khác', hasSeeAll: false });
      othersInGroup.forEach((item) => {
        const mId = String(item._id || item);
        const role = mId === String(adminId) ? 'admin' : (coAdminIds.includes(mId) ? 'coAdmin' : 'member');
        data.push({ type: 'member', data: item, isFriend: false, role });
      });
    }

    return data;
  }, [activeTab, friendsInGroup, othersInGroup, admins, coAdmins, conversationMeta]);

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

          <TouchableOpacity onPress={handleOpenEditGroup} activeOpacity={0.7}>
            <Text style={styles.changeInfoText}>Đổi tên hoặc ảnh</Text>
          </TouchableOpacity>
        </View>




        {/* Conversation Info Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Thông tin về đoạn chat</Text>
          <View style={styles.cardContainer}>
            <TouchableOpacity 
              style={[styles.listItem, !isCurrentUserAdminOrCoAdmin && styles.lastListItem]} 
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

            {isCurrentUserAdminOrCoAdmin && (
              <TouchableOpacity 
                style={[styles.listItem, styles.lastListItem]} 
                activeOpacity={0.7}
                onPress={() => setShowJoinRequestsModal(true)}
              >
                <View style={[styles.listIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="person-add" size={20} color="#D97706" />
                </View>
                <Text style={styles.listItemText}>Yêu cầu chờ duyệt</Text>
                {conversationMeta?.joinRequests?.length > 0 && (
                  <View style={[styles.memberCountBadge, { backgroundColor: '#EF4444' }]}>
                    <Text style={[styles.memberCountText, { color: '#FFFFFF' }]}>
                      {conversationMeta.joinRequests.length}
                    </Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
          </View>
        </View>


        {/* Invite Link Section */}
        {(isCurrentUserAdminOrCoAdmin || conversationMeta?.inviteLinkEnabled) && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Liên kết mời nhóm</Text>
            <View style={styles.cardContainer}>
              {isCurrentUserAdminOrCoAdmin && (
                <View style={styles.listItem}>
                  <View style={[styles.listIconWrap, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="link-outline" size={20} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemText}>Tham gia bằng liên kết</Text>
                    <Text style={styles.disabledLabel}>Cho phép mọi người tham gia nhóm bằng link</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleToggleInviteLink}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={conversationMeta?.inviteLinkEnabled ? 'toggle' : 'toggle-outline'}
                      size={40}
                      color={conversationMeta?.inviteLinkEnabled ? '#0b74ff' : '#D1D5DB'}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {conversationMeta?.inviteLinkEnabled && conversationMeta?.inviteCode && (
                <View style={[styles.listItem, styles.lastListItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <Text style={styles.inviteLinkUrl} numberOfLines={1}>
                    {`vibesport://chat/invite/${conversationMeta.inviteCode}`}
                  </Text>
                  <View style={styles.inviteActionsRow}>
                    <TouchableOpacity
                      onPress={handleCopyInviteLink}
                      style={styles.inviteActionBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="copy-outline" size={16} color="#0b74ff" />
                      <Text style={styles.inviteActionBtnText}>Sao chép</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleShareInviteLink}
                      style={styles.inviteActionBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="share-social-outline" size={16} color="#0b74ff" />
                      <Text style={styles.inviteActionBtnText}>Chia sẻ</Text>
                    </TouchableOpacity>
                    {isCurrentUserAdminOrCoAdmin && (
                      <TouchableOpacity
                        onPress={handleRevokeInviteLink}
                        style={[styles.inviteActionBtn, styles.revokeBtn]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="refresh-outline" size={16} color="#EF4444" />
                        <Text style={[styles.inviteActionBtnText, { color: '#EF4444' }]}>Đặt lại link</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Leave Group Option */}
        <View style={[styles.sectionContainer, { marginTop: 8 }]}>
          <View style={styles.cardContainer}>
            <TouchableOpacity 
              style={[styles.listItem, styles.lastListItem]} 
              activeOpacity={0.7}
              onPress={handleLeaveGroup}
            >
              <View style={[styles.listIconWrap, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.listItemText, { color: '#EF4444' }]}>Rời khỏi cuộc trò chuyện</Text>
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
        onDismiss={() => {
          if (Platform.OS === 'ios' && pendingImageAction) {
            processGroupImagePick(pendingImageAction);
          }
        }}
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

              const nickname = hasDetails ? getMemberNickname(member._id) : '';
              const displayName = nickname ? `${nickname} (${name})` : name;
              const isMuted = hasDetails && isMemberMuted(member._id);

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
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <Text style={styles.darkFriendName}>{displayName}</Text>
                      {(item.role === 'admin' || item.role === 'coAdmin') && (
                        <View style={[styles.roleBadge, { backgroundColor: '#FEE2E2' }]}>
                          <Text style={[styles.roleBadgeText, { color: '#EF4444' }]}>Admin</Text>
                        </View>
                      )}
                      {isMuted && (
                        <View style={[styles.roleBadge, { backgroundColor: '#F3F4F6' }]}>
                          <Text style={[styles.roleBadgeText, { color: '#6B7280' }]}>Bị chặn</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.darkFriendSubtitle}>{subtitleText}</Text>
                  </TouchableOpacity>

                  {/* Actions on the right side */}
                  {!isMe && (
                    <TouchableOpacity 
                      style={styles.darkMoreBtn} 
                      activeOpacity={0.8}
                      onPress={() => handleOpenOptions(member)}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        {/* Member Options Bottom Sheet Modal nested inside Members Modal */}
        {showOptionsModal && (
          <Animated.View style={[styles.customOptionsModalOverlay, { opacity: backdropOpacity }]}>
            <TouchableWithoutFeedback onPress={handleCloseOptions}>
              <View style={styles.customOptionsClickableBg} />
            </TouchableWithoutFeedback>
            <Animated.View style={[styles.optionsModalContent, { transform: [{ translateY: slideAnim }] }]}>
              {/* Main Options Card */}
              <View style={styles.optionsCard}>
                <View style={styles.optionsHeader}>
                  <Text style={styles.optionsHeaderTitle}>{selectedMember?.name}</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.optionsItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setShowOptionsModal(false);
                    setShowMembersModal(false);
                    navigation.navigate('UserProfile', { userId: selectedMember?._id });
                  }}
                >
                  <Text style={styles.optionsItemTextBlue}>Xem trang cá nhân</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.optionsItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (selectedMember?._id) {
                      handleMessageUser(selectedMember._id);
                    }
                  }}
                >
                  <Text style={styles.optionsItemTextBlue}>Nhắn tin</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.optionsItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (selectedMember) {
                      handleOpenNicknameModal(selectedMember);
                    }
                  }}
                >
                  <Text style={styles.optionsItemTextBlue}>Đặt biệt danh</Text>
                </TouchableOpacity>

                {canChangeRole && (
                  <TouchableOpacity 
                    style={styles.optionsItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (selectedMember) {
                        handleToggleCoAdmin(selectedMember, targetMemberRole);
                      }
                    }}
                  >
                    <Text style={styles.optionsItemTextBlue}>
                      {targetMemberRole === 'coAdmin' ? 'Gỡ vai trò Admin' : 'Chỉ định làm Admin'}
                    </Text>
                  </TouchableOpacity>
                )}

                {canMuteUnmute && (
                  <TouchableOpacity 
                    style={styles.optionsItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (selectedMember) {
                        handleToggleMuteMember(selectedMember, targetMemberIsMuted);
                      }
                    }}
                  >
                    <Text style={styles.optionsItemTextRed}>
                      {targetMemberIsMuted ? 'Bỏ chặn thành viên' : 'Chặn thành viên'}
                    </Text>
                  </TouchableOpacity>
                )}

                {!isFriendSelectedMember && selectedMember?.name !== 'Người dùng Facebook' && (
                  <TouchableOpacity 
                    style={styles.optionsItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (selectedMember) {
                        handleAddFriend(selectedMember);
                      }
                    }}
                  >
                    <Text style={styles.optionsItemTextBlue}>Thêm bạn bè</Text>
                  </TouchableOpacity>
                )}

                {!canMuteUnmute && (
                  <TouchableOpacity 
                    style={styles.optionsItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (selectedMember) {
                        handleBlockMember(selectedMember);
                      }
                    }}
                  >
                    <Text style={styles.optionsItemTextRed}>Chặn</Text>
                  </TouchableOpacity>
                )}

                {canRemove && (
                  <TouchableOpacity 
                    style={[styles.optionsItem, styles.lastOptionsItem]}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (selectedMember) {
                        handleRemoveMember(selectedMember);
                      }
                    }}
                  >
                    <Text style={styles.optionsItemTextRed}>Xóa khỏi nhóm</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Cancel Button */}
              <TouchableOpacity 
                style={styles.optionsCancelBtn}
                activeOpacity={0.8}
                onPress={handleCloseOptions}
              >
                <Text style={styles.optionsCancelBtnText}>Hủy</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        )}

        {/* Add Member View Overlay nested inside Members Modal */}
        {showAddMemberModal && (
          <Animated.View style={[styles.customAddMemberOverlay, { opacity: addMemberBackdropOpacity }]}>
            <TouchableWithoutFeedback onPress={() => handleCloseAddMember()}>
              <View style={styles.customAddMemberClickableBg} />
            </TouchableWithoutFeedback>
            <Animated.View style={[styles.tallModalContent, { transform: [{ translateY: addMemberSlideAnim }] }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => handleCloseAddMember()} hitSlop={10}>
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
            </Animated.View>
          </Animated.View>
        )}
      </View>
      </Modal>

      {/* Nickname Modal */}
      <Modal
        visible={showNicknameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNicknameModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowNicknameModal(false)}>
          <View style={styles.nicknameModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.nicknameModalContent}>
                <Text style={styles.nicknameModalTitle}>
                  Biệt danh của {nicknameTargetMember?.name}
                </Text>
                <TextInput
                  style={styles.nicknameInput}
                  value={editingNickname}
                  onChangeText={setEditingNickname}
                  placeholder="Nhập biệt danh"
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                  maxLength={30}
                />
                <View style={styles.nicknameModalButtons}>
                  <TouchableOpacity
                    style={styles.nicknameCancelBtn}
                    onPress={() => setShowNicknameModal(false)}
                    disabled={isUpdatingNickname}
                  >
                    <Text style={styles.nicknameCancelBtnText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.nicknameSaveBtn}
                    onPress={handleSaveNickname}
                    disabled={isUpdatingNickname}
                  >
                    {isUpdatingNickname ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.nicknameSaveBtnText}>Lưu</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Join Requests Modal */}
      <Modal
        visible={showJoinRequestsModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowJoinRequestsModal(false)}
      >
        <View style={styles.darkModalContainer}>
          {/* Header */}
          <View style={[styles.darkHeader, { paddingTop: insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 44 : 16) }]}>
            <TouchableOpacity onPress={() => setShowJoinRequestsModal(false)} style={styles.darkHeaderBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color="#111827" />
            </TouchableOpacity>
            
            <View style={styles.darkHeaderTitleWrap}>
              <Text style={styles.darkHeaderTitle}>Yêu cầu chờ duyệt</Text>
              <Text style={styles.darkHeaderSubtitle}>
                {conversationMeta?.joinRequests?.length || 0} người đang chờ duyệt
              </Text>
            </View>
            <View style={styles.darkHeaderBtn} />
          </View>

          <FlatList
            data={conversationMeta?.joinRequests || []}
            keyExtractor={(item) => String(item.userId?._id || item.userId)}
            contentContainerStyle={styles.requestsList}
            ListEmptyComponent={
              <View style={styles.emptyRequestsWrap}>
                <Ionicons name="people-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyRequestsText}>Không có yêu cầu tham gia nào</Text>
              </View>
            }
            renderItem={({ item }) => {
              const reqUser = item.userId;
              if (!reqUser) return null;
              const userId = reqUser._id;
              const userName = reqUser.name || 'Thành viên VibeSport';
              const userPic = reqUser.picture;
              const isProcessing = processingJoinRequest === userId;

              return (
                <View style={styles.requestItem}>
                  {userPic ? (
                    <Image source={{ uri: fixMediaUrl(userPic) }} style={styles.requestAvatar} />
                  ) : (
                    <View style={[styles.requestAvatarFallback, { backgroundColor: getAvatarColor(userName) }]}>
                      <Text style={styles.requestAvatarText}>{getInitials(userName)}</Text>
                    </View>
                  )}

                  <View style={styles.requestDetails}>
                    <Text style={styles.requestName} numberOfLines={1}>{userName}</Text>
                    {reqUser.area ? (
                      <Text style={styles.requestSubtext} numberOfLines={1}>
                        {reqUser.area} {reqUser.favoriteSport ? `• ${reqUser.favoriteSport}` : ''}
                      </Text>
                    ) : (
                      <Text style={styles.requestSubtext}>Muốn tham gia nhóm</Text>
                    )}
                  </View>

                  <View style={styles.requestActionRow}>
                    <TouchableOpacity
                      onPress={() => handleRejectJoinRequest(userId, userName)}
                      disabled={isProcessing}
                      style={[styles.actionBtn, styles.rejectActionBtn]}
                    >
                      <Text style={[styles.actionBtnText, styles.rejectActionText]}>Từ chối</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleApproveJoinRequest(userId)}
                      disabled={isProcessing}
                      style={[styles.actionBtn, styles.approveActionBtn]}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.actionBtnText, styles.approveActionText]}>Phê duyệt</Text>
                      )}
                    </TouchableOpacity>
                  </View>
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
  customAddMemberOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 9998,
  },
  customAddMemberClickableBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  customOptionsModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    zIndex: 9999,
  },
  customOptionsClickableBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  optionsModalContent: {
    width: '100%',
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  optionsHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  optionsHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  optionsItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  lastOptionsItem: {
    borderBottomWidth: 0,
  },
  optionsItemTextBlue: {
    fontSize: 18,
    fontWeight: '500',
    color: '#0b74ff',
  },
  optionsItemTextRed: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FF3B30',
  },
  optionsCancelBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsCancelBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0b74ff',
  },
  inviteLinkUrl: {
    fontSize: 14,
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 12,
  },
  inviteActionsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-start',
  },
  inviteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  inviteActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0b74ff',
  },
  revokeBtn: {
    backgroundColor: '#FEF2F2',
    marginLeft: 'auto',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  nicknameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  nicknameModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  nicknameModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  nicknameInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 20,
  },
  nicknameModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  nicknameCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  nicknameCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  nicknameSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0b74ff',
    alignItems: 'center',
  },
  nicknameSaveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requestsList: {
    padding: 16,
  },
  emptyRequestsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyRequestsText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  requestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
  },
  requestAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  requestDetails: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  requestSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  requestActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectActionBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  rejectActionText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  approveActionBtn: {
    backgroundColor: '#10B981',
  },
  approveActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
