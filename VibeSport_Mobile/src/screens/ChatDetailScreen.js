import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  acceptConversation,
  blockConversation,
  deleteConversation,
  deletePendingMessages,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  muteConversation,
  sendMessage,
  sendImageMessage,
  setActiveConversation,
  unmuteConversation,
  pinMessage,
  unpinMessage,
  recallMessage,
} from '../redux/chatSlice';
import { API_BASE_URL } from '../components/constants/api';
import { getPresenceDisplay } from '../utils/presence';

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

const formatMessageTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export default function ChatDetailScreen({ route, navigation }) {
  const { conversationId, peer } = route.params;
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { loadingMessages, sending, accepting, processing, conversations } = useSelector((state) => state.chat);
  const token = useSelector((state) => state.auth.token);
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [showPinnedList, setShowPinnedList] = useState(false);

  const flatListRef = useRef(null);
  const currentUserId = user?.id || user?._id;

  const conversationMeta = conversations.find((item) => item._id === conversationId);

  const rawAccepted = useSelector((state) => state.chat.messagesByConversation[conversationId]);
  const pendingMessages = conversationMeta?.pendingMessages || [];

  const allMessages = useMemo(() => {
    const accepted = rawAccepted || [];
    return [...pendingMessages, ...accepted];
  }, [pendingMessages, rawAccepted]);

  const {
    status = 'pending',
    isFriend = false,
    isGroup: isGroupFromMeta = false,
    isPending = false,
    isMyPendingRequest = false,
    hasOtherPendingRequest = false,
    myPendingCount = 0,
    remainingPendingMessages = 0,
    blockedByMe = false,
    blockedByOther = false,
    canChat = false,
    canSendPending = false,
    isMuted: conversationMuted = false,
  } = conversationMeta || {};

  const isGroup = route.params.isGroup || isGroupFromMeta;

  const [presenceTick, setPresenceTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setPresenceTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const presence = useMemo(() => {
    if (isGroup || !peer?.lastSeenAt) return null;
    return getPresenceDisplay(peer.lastSeenAt);
  }, [isGroup, peer?.lastSeenAt, presenceTick]);

  const peerName = useMemo(() => {
    if (isGroup) {
      return conversationMeta?.name || peer?.name || 'Nhóm VibeSport';
    }
    const peerId = String(peer?._id || peer);
    const nickname = conversationMeta?.nicknames?.[peerId];
    if (nickname) return nickname;
    return peer?.name || 'Thành viên VibeSport';
  }, [isGroup, conversationMeta, peer]);

  const isMutedInGroup = useMemo(() => {
    if (!isGroup) return false;
    return (conversationMeta?.mutedMembers || []).some(id => String(id._id || id) === String(currentUserId));
  }, [isGroup, conversationMeta?.mutedMembers, currentUserId]);

  const pinnedMessages = conversationMeta?.pinnedMessages || [];
  const pinnedCount = pinnedMessages.length;

  React.useEffect(() => {
    setIsMuted(conversationMuted);
  }, [conversationMuted]);

  useEffect(() => {
    dispatch(setActiveConversation(conversationId));
    // Fetch messages from Message collection
    dispatch(fetchMessages({ conversationId }));
    dispatch(markConversationRead(conversationId));

    return () => {
      dispatch(setActiveConversation(null));
    };
  }, [conversationId, dispatch]);

  useEffect(() => {
    if (allMessages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, [allMessages.length]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || (!canChat && !canSendPending)) return;

    setInput('');
    try {
      await dispatch(sendMessage({ conversationId, content: trimmed })).unwrap();
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    } catch (error) {
      setInput(trimmed);
      Alert.alert('Không gửi được', error || 'Không thể gửi tin nhắn');
    }
  };

  const handlePickImage = async () => {
    if (sending) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setPendingImage(result.assets[0]);
    }
  };

  const handleSendImage = async () => {
    if (!pendingImage || sending) return;
    const uri = pendingImage.uri;
    const uriParts = uri.split('.');
    const fileType = uriParts[uriParts.length - 1];
    const formData = new FormData();
    formData.append('image', {
      uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
      name: uri.split('/').pop() || `chat-image.${fileType}`,
      type: `image/${fileType}`,
    });
    setPendingImage(null);
    try {
      await dispatch(sendImageMessage({ conversationId, formData })).unwrap();
      requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      Alert.alert('Lỗi', error || 'Không thể gửi ảnh');
    }
  };

  const handleAccept = async () => {
    try {
      await dispatch(acceptConversation(conversationId)).unwrap();
    } catch (error) {
      Alert.alert('Lỗi', error || 'Không thể xác nhận tin nhắn chờ');
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Xóa tin nhắn chờ',
      'Bạn có chắc muốn xóa tin nhắn chờ? Hành động này không thể hoàn tác.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deletePendingMessages(conversationId)).unwrap();
            } catch (error) {
              Alert.alert('Lỗi', error || 'Không thể xóa tin nhắn chờ');
            }
          },
        },
      ]
    );
  };

  const handleBlock = () => {
    Alert.alert(
      'Chặn cuộc trò chuyện',
      `Bạn có chắc muốn chặn ${peerName}? Bạn sẽ không nhận được tin nhắn từ họ nữa.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Chặn',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(blockConversation(conversationId)).unwrap();
              navigation.goBack();
            } catch (error) {
              Alert.alert('Lỗi', error || 'Không thể chặn cuộc trò chuyện');
            }
          },
        },
      ]
    );
  };

  const handleDeleteConversation = () => {
    Alert.alert(
      'Xóa cuộc trò chuyện',
      `Bạn có chắc muốn xóa cuộc trò chuyện với ${peerName} không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deleteConversation(conversationId)).unwrap();
              navigation.goBack();
            } catch (error) {
              Alert.alert('Lỗi', error || 'Không thể xóa cuộc trò chuyện');
            }
          },
        },
      ]
    );
  };

  const handleToggleMute = async () => {
    try {
      if (isMuted) {
        await dispatch(unmuteConversation(conversationId)).unwrap();
        setIsMuted(false);
      } else {
        await dispatch(muteConversation(conversationId)).unwrap();
        setIsMuted(true);
      }
    } catch (error) {
      Alert.alert('Lỗi', error || 'Không thể cập nhật thông báo');
    }
  };

  const handleViewProfile = () => {
    navigation.navigate('UserProfile', { userId: peer?._id });
  };

  const handlePinMessage = async () => {
    if (!selectedMessage) return;
    try {
      await dispatch(pinMessage({ conversationId, messageId: selectedMessage._id })).unwrap();
      setShowMessageMenu(false);
      setSelectedMessage(null);
    } catch (error) {
      Alert.alert('Lỗi', error || 'Không thể ghim tin nhắn');
    }
  };

  const handleUnpinMessage = async (messageId) => {
    try {
      await dispatch(unpinMessage({ conversationId, messageId })).unwrap();
    } catch (error) {
      Alert.alert('Lỗi', error || 'Không thể bỏ ghim tin nhắn');
    }
  };

  const handleRecallMessage = async () => {
    if (!selectedMessage) return;
    try {
      await dispatch(recallMessage({ messageId: selectedMessage._id })).unwrap();
    } catch (error) {
      Alert.alert('Lỗi', error || 'Không thể thu hồi tin nhắn');
    } finally {
      setShowMessageMenu(false);
      setSelectedMessage(null);
    }
  };



  const renderMessageContent = (content, isMine) => {
    if (!content) return '';
    const regex = /vibesport:\/\/chat\/invite\/([a-fA-F0-9]+)/gi;
    
    // Quick check to avoid regex if not containing invite scheme
    if (!content.toLowerCase().includes('vibesport://chat/invite/')) {
      return content;
    }

    const parts = [];
    let lastIndex = 0;
    let match;
    let hasMatch = false;

    // Use light sky blue for own message bubble (blue background) and brand blue for peer message bubble (white background)
    const linkColor = isMine ? '#BFDBFE' : '#0b74ff';

    while ((match = regex.exec(content)) !== null) {
      hasMatch = true;
      const matchIndex = match.index;
      const fullLink = match[0];
      const inviteCode = match[1];

      // Add text before link
      if (matchIndex > lastIndex) {
        parts.push(content.substring(lastIndex, matchIndex));
      }

      // Add clickable link text
      parts.push(
        <Text
          key={`link-${matchIndex}`}
          style={{ color: linkColor, textDecorationLine: 'underline', fontWeight: 'bold' }}
          onPress={() => {
            navigation.navigate('JoinGroup', { code: inviteCode });
          }}
        >
          {fullLink}
        </Text>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return hasMatch ? parts : content;
  };

  const renderMessage = ({ item }) => {
    const senderId = item.senderId?._id || item.senderId;
    const isMine = String(senderId) === String(currentUserId);
    const isPending = !!item.isPending;
    const isRecalled = !!item.isRecalled;

    const rowStyle = isMine
      ? styles.messageRowMine
      : styles.messageRowPeer;
    const bubbleStyle = isMine
      ? styles.messageBubbleMine
      : styles.messageBubblePeer;
    const textStyle = isMine ? styles.messageTextMine : styles.messageText;
    const timeStyle = isMine ? styles.messageTimeMine : styles.messageTime;

    const getSenderName = () => {
      const sId = String(senderId);
      const nickname = conversationMeta?.nicknames?.[sId];
      if (nickname) return nickname;
      return item.senderId?.name || 'Thành viên';
    };

    return (
      <TouchableOpacity
        activeOpacity={isRecalled ? 1 : 0.8}
        onLongPress={() => {
          if (isRecalled) return;
          setSelectedMessage(item);
          setShowMessageMenu(true);
        }}
        delayLongPress={500}
      >
        <View style={[styles.messageRow, rowStyle]}>
          <View style={[styles.messageContainer, isMine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
            {!isMine && isGroup && (
              <Text style={styles.senderName}>{getSenderName()}</Text>
            )}
            <View style={[styles.messageBubble, bubbleStyle]}>
              {isRecalled ? (
                <Text style={[textStyle, isMine ? styles.recalledTextMine : styles.recalledText]}>
                  Tin nhắn đã bị thu hồi
                </Text>
              ) : item.type === 'image' && item.mediaUrl ? (
                <Image
                  source={{ uri: fixMediaUrl(item.mediaUrl) }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={textStyle}>{renderMessageContent(item.content, isMine)}</Text>
              )}
              <Text style={timeStyle}>{formatMessageTime(item.createdAt)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatusBanner = () => {
    if (blockedByMe) {
      return (
        <View style={styles.blockedBanner}>
          <Ionicons name="ban-outline" size={20} color="#DC2626" />
          <Text style={styles.blockedBannerText}>
            Bạn đã chặn {peerName}. Nhấn bỏ chặn trong phần Tin nhắn bị chặn.
          </Text>
        </View>
      );
    }

    if (isFriend || status === 'active') return null;

    if (hasOtherPendingRequest) {
      return (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerText}>
            {peerName} đã gửi tin nhắn cho bạn.
          </Text>
          <View style={styles.pendingBannerActions}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={processing}
              activeOpacity={0.85}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  <Text style={styles.deleteButtonText}>Xóa</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.blockButton}
              onPress={handleBlock}
              disabled={processing}
              activeOpacity={0.85}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#64748B" />
              ) : (
                <>
                  <Ionicons name="ban-outline" size={14} color="#64748B" />
                  <Text style={styles.blockButtonText}>Chặn</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              disabled={accepting}
              activeOpacity={0.85}
            >
              {accepting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.acceptButtonText}>Chấp nhận</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (isMyPendingRequest) {
      return (
        <View style={styles.pendingBannerInfo}>
          <Ionicons name="time-outline" size={14} color="#1D4ED8" />
          <Text style={styles.pendingBannerInfoText}>
            Tin nhắn đang chờ xác nhận. Bạn đã gửi {myPendingCount}/3 tin nhắn chờ.
          </Text>
        </View>
      );
    }

    return null;
  };

  const getMessageId = (pinned) => {
    const raw = pinned?.messageId;
    return typeof raw === 'object' ? String(raw?._id || raw) : String(raw || '');
  };

  const renderPinnedBanner = () => {
    if (!pinnedCount) return null;

    const lastPinned = pinnedMessages[pinnedMessages.length - 1];
    const messageId = getMessageId(lastPinned);
    const pinnedMsg = allMessages.find((m) => String(m._id) === messageId);

    let bannerText;
    if (pinnedCount === 1 && pinnedMsg) {
      const content = pinnedMsg.type === 'image' ? '📷 Ảnh đã ghim' : (pinnedMsg.content || 'Tin nhắn đã ghim');
      const senderName = pinnedMsg.senderId?.name || 'Thành viên';
      bannerText = `${senderName}: ${content}`;
    } else {
      bannerText = `${pinnedCount} tin nhắn đã được ghim`;
    }

    return (
      <TouchableOpacity
        style={styles.pinnedBanner}
        activeOpacity={0.8}
        onPress={() => {
          if (pinnedCount === 1 && pinnedMsg) {
            const index = allMessages.findIndex((m) => String(m._id) === messageId);
            if (index !== -1 && flatListRef.current) {
              try {
                flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
              } catch {
                flatListRef.current?.scrollToEnd({ animated: true });
              }
            }
          }
          setShowPinnedList(true);
        }}
        onLongPress={() => {
          if (pinnedMessages.length > 0) {
            const lastPinned = pinnedMessages[pinnedMessages.length - 1];
            Alert.alert(
              'Bỏ ghim tin nhắn',
              'Bạn có muốn bỏ ghim tin nhắn này?',
              [
                { text: 'Hủy', style: 'cancel' },
                {
                  text: 'Bỏ ghim',
                  style: 'destructive',
                  onPress: () => handleUnpinMessage(getMessageId(lastPinned)),
                },
              ]
            );
          }
        }}
        delayLongPress={500}
      >
        <Ionicons name="pin" size={14} color="#0b74ff" style={styles.pinnedIcon} />
        <View style={styles.pinnedContent}>
          <Text style={styles.pinnedText} numberOfLines={1}>
            {bannerText}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#0b74ff" />
      </TouchableOpacity>
    );
  };

  const renderInputBar = () => {
    if (blockedByMe) {
      return (
        <View style={styles.inputBarDisabled}>
          <Text style={styles.inputDisabledText}>Bạn đã chặn người này</Text>
        </View>
      );
    }

    if (blockedByOther) {
      return (
        <View style={styles.inputBarDisabled}>
          <Text style={styles.inputDisabledText}>Bạn không thể nhắn tin cho người này</Text>
        </View>
      );
    }

    if (isMutedInGroup) {
      return (
        <View style={styles.inputBarDisabled}>
          <Text style={styles.inputDisabledText}>Bạn đã bị chặn gửi tin nhắn trong nhóm này</Text>
        </View>
      );
    }

    if (canChat) {
      return (
        <View>
          {/* Preview ảnh chờ gửi */}
          {pendingImage && (
            <View style={styles.imagePreviewBar}>
              <Image source={{ uri: pendingImage.uri }} style={styles.imagePreviewThumb} />
              <Text style={styles.imagePreviewText} numberOfLines={1}>
                {pendingImage.uri.split('/').pop()}
              </Text>
              <TouchableOpacity onPress={() => setPendingImage(null)} style={styles.imagePreviewRemove}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSendImage}
                disabled={sending}
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputBar}>
            {/* Icon chọn ảnh */}
            <TouchableOpacity
              onPress={handlePickImage}
              style={styles.imagePickBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={sending}
            >
              <Ionicons name="image-outline" size={24} color={sending ? '#C4C9D4' : '#0b74ff'} />
            </TouchableOpacity>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor="#94A3B8"
              style={styles.input}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || sending}
              style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (canSendPending) {
      return (
        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Gửi tin nhắn chờ (${remainingPendingMessages} tin còn lại)...`}
            placeholderTextColor="#94A3B8"
            style={styles.input}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || sending}
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.inputBarDisabled}>
        <Text style={styles.inputDisabledText}>
          {isPending ? 'Bạn đã gửi tối đa 3 tin nhắn chờ' : 'Cuộc trò chuyện không khả dụng'}
        </Text>
      </View>
    );
  };

  return (
    <Screen style={styles.screen}>
      <ScreenHeader style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />

        <View style={styles.headerAvatarContainer}>
          {peer?.picture ? (
            <Image source={{ uri: fixMediaUrl(peer.picture) }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatarFallback, { backgroundColor: getAvatarColor(peerName) }]}>
              <Text style={styles.headerAvatarText}>{getInitials(peerName)}</Text>
            </View>
          )}
          {!isGroup && presence?.isOnline && (
            <View style={styles.headerOnlineDot} />
          )}
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {peerName}
          </Text>
          {!isGroup ? (
            <Text 
              style={[
                styles.headerMeta, 
                presence?.isOnline && { color: '#22C55E', fontWeight: '600' }
              ]}
              numberOfLines={1}
            >
              {presence ? presence.label : (isFriend ? 'Bạn bè' : (peer?.area || ''))}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.headerMenuBtn}
          onPress={() => setShowMenu(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#374151" />
        </TouchableOpacity>

        {isMuted && (
          <View style={styles.headerMutedIcon}>
            <Ionicons name="notifications-off" size={16} color="#DC2626" />
          </View>
        )}
      </ScreenHeader>

      {renderStatusBanner()}
      {renderPinnedBanner()}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loadingMessages && allMessages.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0b74ff" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={allMessages}
            keyExtractor={(item) => item._id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {renderInputBar()}
      </KeyboardAvoidingView>

      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuContainer}>
                <View style={styles.menuHandle} />

                {!isGroup && (
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuItemBorder]}
                    onPress={() => {
                      setShowMenu(false);
                      handleViewProfile();
                    }}
                  >
                    <Ionicons name="person-outline" size={22} color="#374151" />
                    <Text style={styles.menuItemText}>Xem trang cá nhân</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    handleToggleMute();
                  }}
                >
                  <Ionicons
                    name={isMuted ? 'notifications' : 'notifications-off-outline'}
                    size={22}
                    color="#374151"
                  />
                  <Text style={styles.menuItemText}>
                    {isMuted ? 'Bật thông báo' : 'Tắt thông báo'}
                  </Text>
                </TouchableOpacity>

                {isGroup && (
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuItemBorder]}
                    onPress={() => {
                      setShowMenu(false);
                      navigation.navigate('GroupManagement', { conversationId });
                    }}
                  >
                    <Ionicons name="settings-outline" size={22} color="#374151" />
                    <Text style={styles.menuItemText}>Quản lý nhóm</Text>
                  </TouchableOpacity>
                )}

                {!isGroup && (
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuItemBorder]}
                    onPress={() => {
                      setShowMenu(false);
                      handleBlock();
                    }}
                  >
                    <Ionicons name="ban-outline" size={22} color="#EF4444" />
                    <Text style={[styles.menuItemText, styles.menuItemDanger]}>Chặn cuộc trò chuyện</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemBorder]}
                  onPress={() => {
                    setShowMenu(false);
                    handleDeleteConversation();
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                  <Text style={[styles.menuItemText, styles.menuItemDanger]}>Xóa cuộc trò chuyện</Text>
                </TouchableOpacity>

                {/* Cancel button removed since clicking outside closes the modal */}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showMessageMenu}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowMessageMenu(false);
          setSelectedMessage(null);
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setShowMessageMenu(false);
          setSelectedMessage(null);
        }}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuContainer}>
                <View style={styles.menuHandle} />

                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemBorder]}
                  onPress={() => {
                    setShowMessageMenu(false);
                    const isPinned = pinnedMessages.some(
                      (p) => String((p.messageId && p.messageId._id) || p.messageId) === String(selectedMessage?._id)
                    );
                    if (isPinned) {
                      const pinned = pinnedMessages.find(
                        (p) => String((p.messageId && p.messageId._id) || p.messageId) === String(selectedMessage?._id)
                      );
                      handleUnpinMessage(pinned.messageId);
                    } else {
                      handlePinMessage();
                    }
                  }}
                >
                  <Ionicons
                    name={
                      pinnedMessages.some(
                        (p) => String((p.messageId && p.messageId._id) || p.messageId) === String(selectedMessage?._id)
                      )
                        ? 'pin'
                        : 'pin-outline'
                    }
                    size={22}
                    color="#374151"
                  />
                  <Text style={styles.menuItemText}>
                    {pinnedMessages.some(
                      (p) => String((p.messageId && p.messageId._id) || p.messageId) === String(selectedMessage?._id)
                    )
                      ? 'Bỏ ghim tin nhắn'
                      : 'Ghim tin nhắn'}
                  </Text>
                </TouchableOpacity>

                {selectedMessage && String(selectedMessage.senderId?._id || selectedMessage.senderId) === String(currentUserId) && !selectedMessage.isRecalled && (
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuItemBorder]}
                    onPress={handleRecallMessage}
                  >
                    <MaterialCommunityIcons name="undo" size={22} color="#EF4444" />
                    <Text style={[styles.menuItemText, styles.menuItemDanger]}>Thu hồi tin nhắn</Text>
                  </TouchableOpacity>
                )}

                {/* Cancel button removed since clicking outside closes the modal */}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showPinnedList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPinnedList(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPinnedList(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Tin nhắn đã ghim</Text>
                  <TouchableOpacity onPress={() => setShowPinnedList(false)}>
                    <Ionicons name="close" size={22} color="#374151" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  {pinnedMessages.length === 0 ? (
                    <Text style={styles.emptyFriendsText}>Chưa có tin nhắn nào được ghim</Text>
                  ) : (
                    pinnedMessages.map((pinned, index) => {
                      const messageId = typeof pinned.messageId === 'object' ? String(pinned.messageId._id || pinned.messageId) : String(pinned.messageId || '');
                      const pinnedMsg = allMessages.find((m) => String(m._id) === messageId) || {};
                      const senderName = pinnedMsg.senderId?.name || 'Thành viên';
                      const content = pinnedMsg.type === 'image' ? '📷 Ảnh đã ghim' : (pinnedMsg.content || '');
                      const isPinnedByMe = String(pinned.pinnedBy || '') === String(currentUserId);

                      return (
                        <View key={pinnedMsg._id || messageId || index} style={styles.friendItem}>
                          <View style={styles.pinnedContent}>
                            <Text style={styles.pinnedSender}>{senderName}</Text>
                            <Text style={styles.pinnedText} numberOfLines={1}>{content}</Text>
                          </View>
                          {isPinnedByMe && (
                            <TouchableOpacity
                              style={styles.menuItem}
                              onPress={() => {
                                handleUnpinMessage(messageId);
                                if (pinnedMessages.length <= 1) {
                                  setShowPinnedList(false);
                                }
                              }}
                            >
                              <Ionicons name="pin-outline" size={22} color="#DC2626" />
                              <Text style={[styles.menuItemText, styles.menuItemDanger]}>Bỏ ghim</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
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
    backgroundColor: '#F0F2F5',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerAvatarContainer: {
    position: 'relative',
    marginLeft: 8,
  },
  headerOnlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  headerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  blockedBanner: {
    backgroundColor: '#FEE2E2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockedBannerText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
    flex: 1,
  },
  pendingBanner: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pendingBannerText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
    marginBottom: 12,
  },
  pendingBannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#0b74ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  blockButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  blockButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  pendingBannerInfo: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingBannerInfoText: {
    fontSize: 13,
    color: '#1D4ED8',
    lineHeight: 18,
    flex: 1,
  },
  pendingSection: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
    paddingVertical: 10,
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pendingSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
  },
  messageRow: {
    marginBottom: 6,
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowPeer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '92%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 60,
  },
  messageBubbleMine: {
    backgroundColor: '#0b74ff',
    borderBottomRightRadius: 6,
  },
  messageBubblePeer: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 21,
    flexShrink: 1,
  },
  messageTextMine: {
    color: '#FFFFFF',
    flexShrink: 1,
  },
  messageTime: {
    marginTop: 4,
    fontSize: 10,
    color: '#9CA3AF',
    alignSelf: 'flex-end',
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  inputBarDisabled: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  inputDisabledText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#F3F4F6',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0b74ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  // Icon chọn ảnh trong input bar
  imagePickBtn: {
    marginRight: 6,
    padding: 4,
  },
  // Bubble hiển thị ảnh trong tin nhắn
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 4,
  },
  // Preview bar khi ảnh đang chờ gửi
  imagePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  imagePreviewThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  imagePreviewText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },
  imagePreviewRemove: {
    padding: 2,
  },

  headerMenuBtn: {
    padding: 8,
    marginLeft: 4,
  },
  headerMutedIcon: {
    marginRight: 8,
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
  messageContainer: {
    flexDirection: 'column',
    maxWidth: '85%',
  },
  senderName: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
    marginLeft: 6,
    fontWeight: '600',
  },
  pinnedBanner: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinnedIcon: {
    marginRight: 8,
  },
  pinnedContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinnedSender: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0b74ff',
    marginRight: 4,
  },
  pinnedText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
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
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
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
  recalledText: {
    fontStyle: 'italic',
    color: '#94A3B8',
  },
  recalledTextMine: {
    fontStyle: 'italic',
    color: '#E2E8F0',
  },
});
