import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [viewingImages, setViewingImages] = useState([]);
  const [viewingImageIndex, setViewingImageIndex] = useState(0);

  const flatListRef = useRef(null);
  const currentUserId = user?.id || user?._id;

  const conversationMeta = conversations.find((item) => item._id === conversationId);

  const rawAccepted = useSelector((state) => state.chat.messagesByConversation[conversationId]);
  const pendingMessages = conversationMeta?.pendingMessages || [];

  const allMessages = useMemo(() => {
    const accepted = rawAccepted || [];
    return [...pendingMessages, ...accepted];
  }, [pendingMessages, rawAccepted]);

  const groupedMessages = useMemo(() => {
    const result = [];
    let currentImageGroup = null;

    for (let i = 0; i < allMessages.length; i++) {
      const msg = allMessages[i];
      const senderId = msg.senderId?._id || msg.senderId;

      if (msg.type === 'image' && msg.mediaUrl && !msg.isRecalled) {
        const lastMsgInGroup = currentImageGroup ? currentImageGroup.images[currentImageGroup.images.length - 1] : null;
        if (
          currentImageGroup &&
          lastMsgInGroup &&
          String(currentImageGroup.senderId) === String(senderId) &&
          Math.abs(new Date(msg.createdAt) - new Date(lastMsgInGroup.createdAt)) < 15000
        ) {
          currentImageGroup.images.push(msg);
        } else {
          if (currentImageGroup) {
            result.push(currentImageGroup);
          }
          currentImageGroup = {
            _id: `image-group-${msg._id}`,
            isGroupedImages: true,
            senderId,
            senderIdRaw: msg.senderId,
            createdAt: msg.createdAt,
            images: [msg],
            isPending: msg.isPending,
          };
        }
      } else {
        if (currentImageGroup) {
          result.push(currentImageGroup);
          currentImageGroup = null;
        }
        result.push(msg);
      }
    }

    if (currentImageGroup) {
      result.push(currentImageGroup);
    }

    return result;
  }, [allMessages]);

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
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      for (const img of result.assets) {
        const uri = img.uri;
        const uriParts = uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        const formData = new FormData();
        formData.append('image', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: uri.split('/').pop() || `chat-image.${fileType}`,
          type: `image/${fileType}`,
        });
        
        try {
          await dispatch(sendImageMessage({ conversationId, formData })).unwrap();
        } catch (error) {
          Alert.alert('Lỗi', `Không thể gửi ảnh: ${img.uri.split('/').pop()}`);
        }
      }
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
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

  const renderGroupedImages = (item, isMine) => {
    const images = item.images;
    const count = images.length;

    const renderTimestamp = () => (
      <View style={styles.imageTimeBadge}>
        <Text style={styles.imageTimeText}>{formatMessageTime(item.createdAt)}</Text>
      </View>
    );

    if (count === 1) {
      const img = images[0];
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setViewingImages(images);
            setViewingImageIndex(0);
          }}
          onLongPress={() => {
            setSelectedMessage(img);
            setShowMessageMenu(true);
          }}
          delayLongPress={500}
        >
          <View style={styles.imageMessageContainer}>
            <Image
              source={{ uri: fixMediaUrl(img.mediaUrl) }}
              style={styles.messageImage}
              resizeMode="cover"
            />
            {renderTimestamp()}
          </View>
        </TouchableOpacity>
      );
    }

    if (count === 2) {
      return (
        <View style={styles.imageGridContainer}>
          <View style={styles.imageGridRow}>
            {images.map((img, index) => (
              <TouchableOpacity
                key={img._id || index}
                activeOpacity={0.8}
                onPress={() => {
                  setViewingImages(images);
                  setViewingImageIndex(index);
                }}
                onLongPress={() => {
                  setSelectedMessage(img);
                  setShowMessageMenu(true);
                }}
                delayLongPress={500}
                style={styles.imageGridCellWrapper}
              >
                <Image
                  source={{ uri: fixMediaUrl(img.mediaUrl) }}
                  style={{ width: 110, height: 110 }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
          {renderTimestamp()}
        </View>
      );
    }

    if (count === 3) {
      const img0 = images[0];
      const img1 = images[1];
      const img2 = images[2];
      return (
        <View style={styles.imageGridContainer}>
          {/* Top wide image */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setViewingImages(images);
              setViewingImageIndex(0);
            }}
            onLongPress={() => {
              setSelectedMessage(img0);
              setShowMessageMenu(true);
            }}
            delayLongPress={500}
            style={[styles.imageGridCellWrapper, { width: 224, height: 110, marginBottom: 4 }]}
          >
            <Image
              source={{ uri: fixMediaUrl(img0.mediaUrl) }}
              style={{ width: 224, height: 110 }}
              resizeMode="cover"
            />
          </TouchableOpacity>
          {/* Bottom two side-by-side images */}
          <View style={styles.imageGridRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setViewingImages(images);
                setViewingImageIndex(1);
              }}
              onLongPress={() => {
                setSelectedMessage(img1);
                setShowMessageMenu(true);
              }}
              delayLongPress={500}
              style={styles.imageGridCellWrapper}
            >
              <Image
                source={{ uri: fixMediaUrl(img1.mediaUrl) }}
                style={{ width: 110, height: 110 }}
                resizeMode="cover"
              />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setViewingImages(images);
                setViewingImageIndex(2);
              }}
              onLongPress={() => {
                setSelectedMessage(img2);
                setShowMessageMenu(true);
              }}
              delayLongPress={500}
              style={styles.imageGridCellWrapper}
            >
              <Image
                source={{ uri: fixMediaUrl(img2.mediaUrl) }}
                style={{ width: 110, height: 110 }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
          {renderTimestamp()}
        </View>
      );
    }

    // 4 or more images: 2x2 grid
    const img0 = images[0];
    const img1 = images[1];
    const img2 = images[2];
    const img3 = images[3];
    const hasMore = count > 4;
    const remaining = count - 4;

    return (
      <View style={styles.imageGridContainer}>
        {/* Row 1 */}
        <View style={[styles.imageGridRow, { marginBottom: 4 }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setViewingImages(images);
              setViewingImageIndex(0);
            }}
            onLongPress={() => {
              setSelectedMessage(img0);
              setShowMessageMenu(true);
            }}
            delayLongPress={500}
            style={styles.imageGridCellWrapper}
          >
            <Image
              source={{ uri: fixMediaUrl(img0.mediaUrl) }}
              style={{ width: 110, height: 110 }}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setViewingImages(images);
              setViewingImageIndex(1);
            }}
            onLongPress={() => {
              setSelectedMessage(img1);
              setShowMessageMenu(true);
            }}
            delayLongPress={500}
            style={styles.imageGridCellWrapper}
          >
            <Image
              source={{ uri: fixMediaUrl(img1.mediaUrl) }}
              style={{ width: 110, height: 110 }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
        {/* Row 2 */}
        <View style={styles.imageGridRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setViewingImages(images);
              setViewingImageIndex(2);
            }}
            onLongPress={() => {
              setSelectedMessage(img2);
              setShowMessageMenu(true);
            }}
            delayLongPress={500}
            style={styles.imageGridCellWrapper}
          >
            <Image
              source={{ uri: fixMediaUrl(img2.mediaUrl) }}
              style={{ width: 110, height: 110 }}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setViewingImages(images);
              setViewingImageIndex(3);
            }}
            onLongPress={() => {
              setSelectedMessage(img3);
              setShowMessageMenu(true);
            }}
            delayLongPress={500}
            style={styles.imageGridCellWrapper}
          >
            <Image
              source={{ uri: fixMediaUrl(img3.mediaUrl) }}
              style={{ width: 110, height: 110 }}
              resizeMode="cover"
            />
            {hasMore && (
              <View style={styles.imageGridOverlay}>
                <Text style={styles.imageGridOverlayText}>+{remaining + 1}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        {renderTimestamp()}
      </View>
    );
  };

  const renderMessage = ({ item }) => {
    // Grouped images path
    if (item.isGroupedImages) {
      const isMine = String(item.senderId) === String(currentUserId);
      const rowStyle = isMine ? styles.messageRowMine : styles.messageRowPeer;
      const getSenderName = () => {
        const sId = String(item.senderId);
        const nickname = conversationMeta?.nicknames?.[sId];
        if (nickname) return nickname;
        return item.senderIdRaw?.name || 'Thành viên';
      };

      return (
        <View style={[styles.messageRow, rowStyle]}>
          <View style={[styles.messageContainer, isMine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
            {!isMine && isGroup && (
              <Text style={styles.senderName}>{getSenderName()}</Text>
            )}
            {renderGroupedImages(item, isMine)}
          </View>
        </View>
      );
    }

    // Normal message path (text, recalled, etc.)
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

  const renderHeaderAvatar = () => {
    if (!isGroup || peer?.picture) {
      return peer?.picture ? (
        <Image source={{ uri: fixMediaUrl(peer.picture) }} style={styles.headerAvatar} />
      ) : (
        <View style={[styles.headerAvatarFallback, { backgroundColor: getAvatarColor(peerName) }]}>
          <Text style={styles.headerAvatarText}>{getInitials(peerName)}</Text>
        </View>
      );
    }
    
    // Layered group avatar (Zalo style) inside header (40x40)
    const otherMembers = (conversationMeta?.participants || []).filter(
      (p) => String(p._id || p) !== String(currentUserId)
    );
    const totalCount = otherMembers.length;
    
    if (totalCount === 0) {
      return (
        <View style={[styles.headerAvatarFallback, { backgroundColor: getAvatarColor(peerName) }]}>
          <Text style={styles.headerAvatarText}>{getInitials(peerName)}</Text>
        </View>
      );
    }
    
    if (totalCount === 1) {
      const singleMember = otherMembers[0];
      const displayName = singleMember.name || 'User';
      return singleMember.picture ? (
        <Image source={{ uri: fixMediaUrl(singleMember.picture) }} style={styles.headerAvatar} />
      ) : (
        <View style={[styles.headerAvatarFallback, { backgroundColor: getAvatarColor(displayName) }]}>
          <Text style={styles.headerAvatarText}>{getInitials(displayName)}</Text>
        </View>
      );
    }
    
    if (totalCount === 2) {
      const m0 = otherMembers[0];
      const m1 = otherMembers[1];
      return (
        <View style={styles.headerGroupAvatarGrid}>
          <View style={[styles.headerGroupAvatarItem, { width: 32, height: 32, borderRadius: 16, top: 2, left: 2, backgroundColor: getAvatarColor(m0.name) }]}>
            {m0.picture ? (
              <Image source={{ uri: fixMediaUrl(m0.picture) }} style={{ width: 29, height: 29, borderRadius: 14.5 }} resizeMode="cover" />
            ) : (
              <Text style={[styles.headerGroupAvatarItemText, { fontSize: 10 }]}>{getInitials(m0.name)}</Text>
            )}
          </View>
          <View style={[styles.headerGroupAvatarItem, { width: 32, height: 32, borderRadius: 16, bottom: 2, right: 2, backgroundColor: getAvatarColor(m1.name) }]}>
            {m1.picture ? (
              <Image source={{ uri: fixMediaUrl(m1.picture) }} style={{ width: 29, height: 29, borderRadius: 14.5 }} resizeMode="cover" />
            ) : (
              <Text style={[styles.headerGroupAvatarItemText, { fontSize: 10 }]}>{getInitials(m1.name)}</Text>
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
        <View style={styles.headerGroupAvatarGrid}>
          <View style={[styles.headerGroupAvatarItem, { width: 28, height: 28, borderRadius: 14, top: 1, left: 1, backgroundColor: getAvatarColor(m0.name) }]}>
            {m0.picture ? (
              <Image source={{ uri: fixMediaUrl(m0.picture) }} style={{ width: 25, height: 25, borderRadius: 12.5 }} resizeMode="cover" />
            ) : (
              <Text style={styles.headerGroupAvatarItemText}>{getInitials(m0.name)}</Text>
            )}
          </View>
          <View style={[styles.headerGroupAvatarItem, { width: 28, height: 28, borderRadius: 14, top: 1, right: 1, backgroundColor: getAvatarColor(m1.name) }]}>
            {m1.picture ? (
              <Image source={{ uri: fixMediaUrl(m1.picture) }} style={{ width: 25, height: 25, borderRadius: 12.5 }} resizeMode="cover" />
            ) : (
              <Text style={styles.headerGroupAvatarItemText}>{getInitials(m1.name)}</Text>
            )}
          </View>
          <View style={[styles.headerGroupAvatarItem, { width: 28, height: 28, borderRadius: 14, bottom: 1, left: 14, backgroundColor: getAvatarColor(m2.name) }]}>
            {m2.picture ? (
              <Image source={{ uri: fixMediaUrl(m2.picture) }} style={{ width: 25, height: 25, borderRadius: 12.5 }} resizeMode="cover" />
            ) : (
              <Text style={styles.headerGroupAvatarItemText}>{getInitials(m2.name)}</Text>
            )}
          </View>
        </View>
      );
    }
    
    const m0 = otherMembers[0];
    const m1 = otherMembers[1];
    const m2 = otherMembers[2];
    const m3 = otherMembers[3];
    const hasMore = totalCount > 4;
    const remainingText = (totalCount - 3) > 9 ? '9+' : `+${totalCount - 3}`;
    
    return (
      <View style={styles.headerGroupAvatarGrid}>
        <View style={[styles.headerGroupAvatarItem, { width: 28, height: 28, borderRadius: 14, top: 1, left: 1, backgroundColor: getAvatarColor(m0.name) }]}>
          {m0.picture ? (
            <Image source={{ uri: fixMediaUrl(m0.picture) }} style={{ width: 25, height: 25, borderRadius: 12.5 }} resizeMode="cover" />
          ) : (
            <Text style={styles.headerGroupAvatarItemText}>{getInitials(m0.name)}</Text>
          )}
        </View>
        <View style={[styles.headerGroupAvatarItem, { width: 28, height: 28, borderRadius: 14, top: 1, right: 1, backgroundColor: getAvatarColor(m1.name) }]}>
          {m1.picture ? (
            <Image source={{ uri: fixMediaUrl(m1.picture) }} style={{ width: 25, height: 25, borderRadius: 12.5 }} resizeMode="cover" />
          ) : (
            <Text style={styles.headerGroupAvatarItemText}>{getInitials(m1.name)}</Text>
          )}
        </View>
        <View style={[styles.headerGroupAvatarItem, { width: 28, height: 28, borderRadius: 14, bottom: 1, left: 1, backgroundColor: getAvatarColor(m2.name) }]}>
          {m2.picture ? (
            <Image source={{ uri: fixMediaUrl(m2.picture) }} style={{ width: 25, height: 25, borderRadius: 12.5 }} resizeMode="cover" />
          ) : (
            <Text style={styles.headerGroupAvatarItemText}>{getInitials(m2.name)}</Text>
          )}
        </View>
        {hasMore ? (
          <View style={[styles.headerGroupAvatarItem, { width: 28, height: 28, borderRadius: 14, bottom: 1, right: 1, backgroundColor: '#07823b' }]}>
            <Text style={styles.headerGroupAvatarItemText}>{remainingText}</Text>
          </View>
        ) : (
          <View style={[styles.headerGroupAvatarItem, { width: 28, height: 28, borderRadius: 14, bottom: 1, right: 1, backgroundColor: getAvatarColor(m3.name) }]}>
            {m3.picture ? (
              <Image source={{ uri: fixMediaUrl(m3.picture) }} style={{ width: 25, height: 25, borderRadius: 12.5 }} resizeMode="cover" />
            ) : (
              <Text style={styles.headerGroupAvatarItemText}>{getInitials(m3.name)}</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen style={styles.screen}>
      <ScreenHeader style={styles.header}>
        <BackButton name="arrow-back" onPress={() => navigation.goBack()} />

        <View style={styles.headerAvatarContainer}>
          {renderHeaderAvatar()}
          {!isGroup && presence?.isOnline && (
            <View style={styles.headerOnlineDot} />
          )}
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {peerName}
          </Text>
          {isGroup ? (
            <Text style={styles.headerMeta} numberOfLines={1}>
              {`${conversationMeta?.participants?.length || 0} thành viên`}
            </Text>
          ) : (
            <Text 
              style={[
                styles.headerMeta, 
                presence?.isOnline && { color: '#22C55E', fontWeight: '600' }
              ]}
              numberOfLines={1}
            >
              {presence ? presence.label : (isFriend ? 'Bạn bè' : (peer?.area || ''))}
            </Text>
          )}
        </View>

        {isMuted && (
          <View style={styles.headerMutedIcon}>
            <Ionicons name="notifications-off" size={16} color="#DC2626" />
          </View>
        )}

        <TouchableOpacity
          style={styles.headerCallBtn}
          onPress={() => {
            if (isGroup) {
              Alert.alert('Gọi điện nhóm', 'Tính năng gọi thoại nhóm đang được phát triển.');
            } else {
              const phone = peer?.phone || peer?.phoneNumber;
              if (phone) {
                Linking.openURL(`tel:${phone}`);
              } else {
                Alert.alert('Gọi điện', 'Người dùng này chưa cập nhật số điện thoại.');
              }
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="call-outline" size={20} color="#374151" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerMenuBtn}
          onPress={() => setShowMenu(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#374151" />
        </TouchableOpacity>
      </ScreenHeader>

      {renderStatusBanner()}
      {renderPinnedBanner()}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loadingMessages && groupedMessages.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0b74ff" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={groupedMessages}
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
                  style={[styles.menuItem, styles.menuItemBorder]}
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

                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemBorder]}
                  onPress={() => {
                    setShowMenu(false);
                    Alert.alert('Tìm kiếm tin nhắn', 'Tính năng tìm kiếm tin nhắn trong cuộc trò chuyện đang được phát triển.');
                  }}
                >
                  <Ionicons name="search-outline" size={22} color="#374151" />
                  <Text style={styles.menuItemText}>Tìm kiếm tin nhắn</Text>
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

      <Modal
        visible={viewingImages.length > 0}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingImages([])}
      >
        <View style={styles.imageModalOverlay}>
          {/* Header indicator & Close button */}
          <View style={styles.imageModalHeader}>
            <Text style={styles.imageModalIndicator}>
              {viewingImageIndex + 1} / {viewingImages.length}
            </Text>
            <TouchableOpacity
              style={styles.imageModalCloseBtn}
              onPress={() => setViewingImages([])}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Swipeable FlatList */}
          <FlatList
            data={viewingImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewingImageIndex}
            getItemLayout={(data, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const contentOffset = e.nativeEvent.contentOffset.x;
              const index = Math.round(contentOffset / SCREEN_WIDTH);
              setViewingImageIndex(index);
            }}
            keyExtractor={(item, index) => item._id || `${index}`}
            renderItem={({ item }) => (
              <TouchableWithoutFeedback onPress={() => setViewingImages([])}>
                <View style={{ width: SCREEN_WIDTH, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                  <Image
                    source={{ uri: fixMediaUrl(item.mediaUrl) }}
                    style={styles.imageModalFull}
                    resizeMode="contain"
                  />
                </View>
              </TouchableWithoutFeedback>
            )}
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
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 11,
    marginTop: 0,
    height: 74,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 94, 94, 0.19)',
    elevation: 0,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
  },
  headerAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerGroupAvatarGrid: {
    width: 56,
    height: 56,
    position: 'relative',
  },
  headerGroupAvatarItem: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerGroupAvatarItemText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  headerCallBtn: {
    padding: 8,
    marginRight: -2,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  headerMeta: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '300',
    color: '#7C7C7C',
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
    maxWidth: SCREEN_WIDTH * 0.7,
    borderRadius: 32,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 60,
  },
  messageBubbleMine: {
    backgroundColor: '#0b74ff',
  },
  messageBubblePeer: {
    backgroundColor: '#FFFFFF',
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
    alignItems: 'center',
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
    paddingTop: Platform.OS === 'ios' ? 14 : 10,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    textAlignVertical: 'center',
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
  imageMessageContainer: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageImage: {
    width: 220,
    height: 220,
  },
  imageTimeBadge: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  imageTimeText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  imageGridContainer: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 4,
    backgroundColor: '#FFFFFF',
    width: 232,
  },
  imageGridRow: {
    flexDirection: 'row',
    gap: 4,
  },
  imageGridCellWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
    width: 110,
    height: 110,
  },
  imageGridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageGridOverlayText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imageModalHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  imageModalIndicator: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  imageModalCloseBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalFull: {
    width: '100%',
    height: '100%',
  },


  headerMenuBtn: {
    padding: 8,
    marginLeft: -2,
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
