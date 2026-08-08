import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { sendAiChatRequest } from '../services/aiService';

const ORANGE = '#FF5F3D';

const QUICK_CHIPS = [
  '⚽ Tìm trận bóng đá tối nay',
  '🏸 Tìm trận cầu lông gần đây',
  '❓ Hướng dẫn tạo trận đấu',
  '🏆 Luật chơi Pickleball',
];

export function VibeAiModal({ navigation }) {
  const token = useSelector((state) => state.auth?.token);
  const [modalVisible, setModalVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const [messages, setMessages] = useState([
    {
      id: 'welcome_1',
      sender: 'ai',
      text: 'Xin chào! Tôi là **VibeSport AI** 🤖\nTôi có thể giúp bạn tìm trận đấu, giải đáp luật chơi hoặc cập nhật tin tức thể thao. Bạn cần tôi hỗ trợ gì hôm nay?',
      suggestedMatches: [],
    },
  ]);

  const scrollViewRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query || !query.trim() || loading) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    scrollToBottom();

    try {
      const res = await sendAiChatRequest(query.trim(), token);
      const aiMsg = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: res.replyText,
        suggestedMatches: res.suggestedMatches || [],
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: '⚠️ Không thể kết nối với AI. Vui lòng kiểm tra lại mạng hoặc thử lại sau.',
        suggestedMatches: [],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'ai',
        text: 'Đã làm mới cuộc trò chuyện! Bạn muốn **VibeSport AI** tìm trận hay hỗ trợ gì tiếp theo? 🤖',
        suggestedMatches: [],
      },
    ]);
  };

  const handleNavigateToMatch = (matchId) => {
    setModalVisible(false);
    if (navigation && matchId) {
      navigation.navigate('MatchDetail', { matchId });
    }
  };

  return (
    <>
      {/* Nút bấm tròn nổi ở góc dưới bên phải */}
      <TouchableOpacity
        style={styles.fabCircleButton}
        activeOpacity={0.85}
        onPress={() => setModalVisible(true)}
      >
        <Image
          source={require('../../assets/logovibe_tachnen.png')}
          style={styles.fabLogoImage}
          resizeMode="contain"
          fadeDuration={0}
        />
      </TouchableOpacity>

      {/* Modal dạng Full Screen */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          {/* Header Cố Định Ở Đỉnh — đo chiều cao thực tế để bù trừ cho KeyboardAvoidingView trên iOS */}
          <View
            style={styles.modalHeader}
            onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
          >
            <View style={styles.headerLeft}>
              <View style={styles.headerAvatar}>
                <Image
                  source={require('../../assets/logovibe_tachnen.png')}
                  style={styles.headerLogoImage}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={styles.headerTitle}>VibeSport AI</Text>
                <Text style={styles.headerSub}>Trợ lý thể thao thông minh ⚡</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleClearChat} style={styles.headerIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.headerIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
          </View>

          {/* KeyboardAvoidingView: dùng 'height' cho Android (thay vì undefined) để bàn phím
              không đè lên ô nhập, và bù trừ chiều cao header cho iOS bằng keyboardVerticalOffset */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatBody}
              contentContainerStyle={styles.chatBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={scrollToBottom}
            >
              {messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.msgWrapper,
                    msg.sender === 'user' ? styles.userMsgWrapper : styles.aiMsgWrapper,
                  ]}
                >
                  {msg.sender === 'ai' && (
                    <View style={styles.aiMsgAvatar}>
                      <Image
                        source={require('../../assets/logovibe_tachnen.png')}
                        style={styles.aiMsgAvatarImg}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                  <View
                    style={[
                      styles.msgBubble,
                      msg.sender === 'user' ? styles.userBubble : styles.aiBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.msgText,
                        msg.sender === 'user' ? styles.userMsgText : styles.aiMsgText,
                      ]}
                    >
                      {msg.text}
                    </Text>

                    {/* Card trận đấu gợi ý */}
                    {msg.suggestedMatches && msg.suggestedMatches.length > 0 && (
                      <View style={styles.matchCardsContainer}>
                        <Text style={styles.matchCardSectionTitle}>📌 Trận đấu phù hợp:</Text>
                        {msg.suggestedMatches.map((match, idx) => (
                          <View key={match.matchId || idx} style={styles.matchCard}>
                            <View style={styles.matchCardHeader}>
                              <Text style={styles.matchCardTitle} numberOfLines={1}>
                                ⚽ {match.title || match.sport}
                              </Text>
                              <Text style={styles.matchCardCost}>
                                {match.costPerPerson ? `${match.costPerPerson.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                              </Text>
                            </View>
                            <Text style={styles.matchCardSub} numberOfLines={1}>
                              📍 {match.location || 'Sân thi đấu'}
                            </Text>
                            <Text style={styles.matchCardSub}>
                              🕐 {match.startTime || ''} - {match.date || ''} • 👥 {match.players || ''}
                            </Text>

                            <TouchableOpacity
                              style={styles.matchCardNavBtn}
                              activeOpacity={0.8}
                              onPress={() => handleNavigateToMatch(match.matchId)}
                            >
                              <Text style={styles.matchCardNavBtnText}>Xem chi tiết trận ⚽</Text>
                              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ))}

              {loading && (
                <View style={[styles.msgWrapper, styles.aiMsgWrapper]}>
                  <View style={styles.aiMsgAvatar}>
                    <Image
                      source={require('../../assets/logovibe_tachnen.png')}
                      style={styles.aiMsgAvatarImg}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={[styles.msgBubble, styles.aiBubble, styles.loadingBubble]}>
                    <ActivityIndicator size="small" color={ORANGE} />
                    <Text style={styles.loadingBubbleText}>VibeSport AI đang suy nghĩ...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Quick Chips gợi ý câu hỏi nhanh */}
            <View style={styles.quickChipsWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChipsContent}>
                {QUICK_CHIPS.map((chip, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.quickChipBtn}
                    onPress={() => handleSendMessage(chip.replace(/^[^\s]+\s/, ''))}
                  >
                    <Text style={styles.quickChipText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Ô nhập tin nhắn luôn nổi trên bàn phím */}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.textInput}
                placeholder="Hỏi VibeSport AI (vd: Tìm trận bóng đá...)"
                placeholderTextColor="#9CA3AF"
                value={inputText}
                onChangeText={setInputText}
                onFocus={scrollToBottom}
                onSubmitEditing={() => handleSendMessage()}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
                disabled={!inputText.trim() || loading}
                onPress={() => handleSendMessage()}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabCircleButton: {
    position: 'absolute',
    bottom: 140,
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: ORANGE,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    zIndex: 999,
  },
  fabLogoImage: {
    width: 38,
    height: 38,
  },

  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Header Cố Định
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoImage: {
    width: 26,
    height: 26,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  headerSub: {
    fontSize: 11.5,
    color: '#6B7280',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    padding: 6,
  },

  // Chat Body
  chatBody: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  chatBodyContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    flexGrow: 1,
  },
  msgWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  userMsgWrapper: {
    justifyContent: 'flex-end',
  },
  aiMsgWrapper: {
    justifyContent: 'flex-start',
  },
  aiMsgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  aiMsgAvatarImg: {
    width: 18,
    height: 18,
  },
  msgBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: ORANGE,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMsgText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  aiMsgText: {
    color: '#1F2937',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingBubbleText: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },

  // Match Cards
  matchCardsContainer: {
    marginTop: 10,
    gap: 8,
  },
  matchCardSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  matchCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFD8A8',
    gap: 4,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  matchCardCost: {
    fontSize: 13,
    fontWeight: '800',
    color: ORANGE,
  },
  matchCardSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  matchCardNavBtn: {
    backgroundColor: ORANGE,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  matchCardNavBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Quick Chips
  quickChipsWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  quickChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickChipBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
});