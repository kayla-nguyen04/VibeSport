import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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
} from '../redux/chatSlice';
import { API_BASE_URL } from '../components/constants/api';
import { getMutualFriendsRequest } from '../services/userApi';

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

export default function ChatListScreen({ navigation }) {
  const dispatch = useDispatch();
  const { conversations, loadingConversations } = useSelector((state) => state.chat);
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [activeFilter, setActiveFilter] = useState('Tất cả');
  const [showFilter, setShowFilter] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  // Group creation modal states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [groupSearchText, setGroupSearchText] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupCreationStep, setGroupCreationStep] = useState(1);
  const [creatingGroup, setCreatingGroup] = useState(false);

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
    if (selectedUserIds.length === 1) {
      handleStartSingleChat(selectedUserIds[0]);
    } else if (selectedUserIds.length > 1) {
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
      setShowCreateGroupModal(false);
      navigation.navigate('ChatDetail', {
        conversationId: result.data._id,
        peer: result.data.peer,
      });
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể tạo nhóm trò chuyện');
    } finally {
      setCreatingGroup(false);
    }
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

  // DEBUG: Log all conversations before filtering
  React.useEffect(() => {
    if (allConversations.length === 0) return;
    console.log('[DEBUG ChatListScreen] allConversations:', allConversations.map((item) => ({
      _id: item._id,
      viewState: item.viewState,
      hasOtherPendingRequest: item.hasOtherPendingRequest,
      blockedByMe: item.blockedByMe,
      isHidden: item.isHidden,
      status: item.status,
    })));
    console.log('[DEBUG ChatListScreen] inboxConversations ids:', inboxConversations.map((i) => i._id));
    console.log('[DEBUG ChatListScreen] pendingConversations ids:', pendingConversations.map((i) => i._id));
  }, [allConversations, inboxConversations, pendingConversations]);

  const inboxConversations = React.useMemo(() => {
    return applyFilter(
      allConversations.filter((item) => !item.isHidden && !item.hasOtherPendingRequest)
    );
  }, [allConversations, applyFilter]);

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
    });
  };

  const renderConversationItem = ({ item }) => {
    const peer = item.peer;
    const peerName = peer?.name || 'Thành viên VibeSport';
    const isPending = item.isPending && !item.blockedByMe;
    const hasOtherPendingMessages = (item.otherPendingMessages?.length || 0) > 0;
    const subtitle = isPending
      ? (hasOtherPendingMessages
          ? item.otherPendingMessages?.[0]?.content || 'Tin nhắn chờ xác nhận'
          : 'Chờ bạn chấp nhận')
      : item.lastMessage || 'Bắt đầu trò chuyện';
    const subtitleColor = isPending ? '#0b74ff' : '#6B7280';
    const unreadCount = item.unreadCount || 0;

    return (
      <View style={styles.conversationItem}>
        <TouchableOpacity
          style={styles.conversationItemTouchable}
          activeOpacity={0.85}
          onPress={() => openChat(item)}
        >
          {peer?.picture ? (
            <Image
              source={{ uri: fixMediaUrl(peer.picture) }}
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
              <Text style={styles.timeText}>{formatTime(item.lastMessageAt)}</Text>
            </View>
            <View style={styles.conversationBottomRow}>
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
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
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
        ) : (
          <View style={styles.itemActions}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleToggleMute(item)}
            >
              <Ionicons
                name={item.isMuted ? 'notifications' : 'notifications-off-outline'}
                size={20}
                color={item.isMuted ? '#10B981' : '#6B7280'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleDeleteConversation(item)}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderBlockedItem = ({ item }) => {
    const peer = item.peer;
    const peerName = peer?.name || 'Thành viên VibeSport';
    const isUnblocking = unblockingId === item._id;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        activeOpacity={0.85}
        onPress={() => openChat(item)}
      >
        {peer?.picture ? (
          <Image
            source={{ uri: fixMediaUrl(peer.picture) }}
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

        <View style={styles.conversationBody}>
          <View style={styles.conversationTopRow}>
            <Text style={styles.peerName} numberOfLines={1}>
              {peerName}
            </Text>
            <Ionicons name="ban" size={14} color="#DC2626" />
          </View>
          <View style={styles.conversationBottomRow}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage || 'Bắt đầu trò chuyện'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.unblockButton}
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
      </TouchableOpacity>
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeftBtn}
          activeOpacity={0.7}
          onPress={() => setShowFilter(true)}
        >
          <Ionicons name="options-outline" size={24} color="#262626" />
        </TouchableOpacity>

        <View style={styles.headerTabs}>
          {['inbox', 'requests', 'blocked'].map((tab) => {
            const count =
              tab === 'requests'
                ? pendingConversations.length
                : tab === 'blocked'
                  ? blockedConversations.length
                  : 0;
            const label =
              tab === 'inbox'
                ? 'Hộp thư'
                : tab === 'requests'
                  ? 'Yêu cầu'
                  : 'Bị chặn';

            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.headerTab,
                  activeTab === tab && styles.headerTabActive,
                ]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <View style={styles.headerTabInner}>
                  <Text
                    style={[
                      styles.headerTabText,
                      activeTab === tab && styles.headerTabTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                  {count > 0 && (
                    <View
                      style={[
                        styles.tabBadge,
                        tab === 'blocked' && styles.tabBadgeRed,
                      ]}
                    >
                      <Text style={styles.tabBadgeText}>{count}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.headerRightBtn}
          activeOpacity={0.7}
          onPress={handleOpenCreateGroup}
        >
          <Ionicons name="create-outline" size={26} color="#262626" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#8E8E8E" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm kiếm"
            placeholderTextColor="#8E8E8E"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
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
        visible={showCreateGroupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateGroupModal(false)}
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
                    disabled={selectedUserIds.length === 0}
                  >
                    <Text
                      style={[
                        styles.nextBtnText,
                        selectedUserIds.length === 0 && styles.nextBtnTextDisabled,
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

                <View style={styles.groupNameContainer}>
                  <TextInput
                    value={groupName}
                    onChangeText={setGroupName}
                    placeholder="Nhập tên nhóm..."
                    placeholderTextColor="#8E8E93"
                    style={styles.groupNameInput}
                    autoFocus
                    maxLength={100}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#DBDBDB',
    backgroundColor: '#FFFFFF',
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
    paddingBottom: 8,
  },
  emptyList: {
    flexGrow: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#DBDBDB',
  },
  conversationItemTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ED4956',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  groupModalContainer: {
    backgroundColor: '#1C1C1E',
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
    borderBottomColor: '#2C2C2E',
  },
  cancelBtnText: {
    color: '#0A84FF',
    fontSize: 16,
    fontWeight: '400',
  },
  groupModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  nextBtnText: {
    color: '#0A84FF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextBtnTextDisabled: {
    color: '#48484A',
  },
  modalSearchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    padding: 0,
  },
  suggestionTitle: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#121212',
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
    borderBottomColor: '#2C2C2E',
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#48484A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
  },
  emptyFriendsText: {
    color: '#8E8E93',
    textAlign: 'center',
    fontSize: 14,
    paddingTop: 40,
  },
  groupNameContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  groupNameInput: {
    color: '#FFFFFF',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    paddingVertical: 8,
  },
});
