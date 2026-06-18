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
import { Ionicons } from '@expo/vector-icons';
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
  setActiveConversation,
  unmuteConversation,
} from '../redux/chatSlice';
import { API_BASE_URL } from '../components/constants/api';

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
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const flatListRef = useRef(null);
  const currentUserId = user?.id || user?._id;
  const peerName = peer?.name || 'Thành viên VibeSport';

  // Get conversation metadata from state (for UI decisions, not message source)
  const conversationMeta = conversations.find((item) => item._id === conversationId);

  // Select raw data from Redux
  const rawAccepted = useSelector((state) => state.chat.messagesByConversation[conversationId]);
  const pendingMessages = conversationMeta?.pendingMessages || [];

  // Memoized merge of pending + accepted messages
  const allMessages = useMemo(() => {
    const accepted = rawAccepted || [];
    return [...pendingMessages, ...accepted];
  }, [pendingMessages, rawAccepted]);

  const {
    status = 'pending',
    isFriend = false,
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

  const renderMessage = ({ item }) => {
    const senderId = item.senderId?._id || item.senderId;
    const isMine = String(senderId) === String(currentUserId);
    const isPending = !!item.isPending;

    const rowStyle = isMine
      ? styles.messageRowMine
      : styles.messageRowPeer;
    const bubbleStyle = isMine
      ? styles.messageBubbleMine
      : styles.messageBubblePeer;
    const textStyle = isMine ? styles.messageTextMine : styles.messageText;
    const timeStyle = isMine ? styles.messageTimeMine : styles.messageTime;

    return (
      <View style={[styles.messageRow, rowStyle]}>
        <View style={[styles.messageBubble, bubbleStyle]}>
          <Text style={textStyle}>{item.content}</Text>
          <Text style={timeStyle}>{formatMessageTime(item.createdAt)}</Text>
        </View>
      </View>
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

    // Chỉ hiện banner yêu cầu cho người nhận (có tin nhắn pending từ người khác)
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

    if (canChat) {
      return (
        <View style={styles.inputBar}>
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

  return (
    <Screen style={styles.screen}>
      <ScreenHeader style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />

        {peer?.picture ? (
          <Image source={{ uri: fixMediaUrl(peer.picture) }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatarFallback, { backgroundColor: getAvatarColor(peerName) }]}>
            <Text style={styles.headerAvatarText}>{getInitials(peerName)}</Text>
          </View>
        )}

        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {peerName}
          </Text>
          {isFriend ? (
            <Text style={styles.headerMeta}>Bạn bè</Text>
          ) : peer?.area ? (
            <Text style={styles.headerMeta}>{peer.area}</Text>
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

                <TouchableOpacity
                  style={styles.menuCancel}
                  onPress={() => setShowMenu(false)}
                >
                  <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>Hủy</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
  },
  headerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
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
    maxWidth: '78%',
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
  },
  messageTextMine: {
    color: '#FFFFFF',
  },
  messageTime: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
    alignSelf: 'flex-end',
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.75)',
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
});
