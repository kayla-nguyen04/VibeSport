import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import { fetchChatUnreadCount, fetchConversations } from '../redux/chatSlice';
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

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;
  if (diffHours < 24) return `${diffHours} giờ`;
  if (diffDays < 7) return `${diffDays} ngày`;
  return date.toLocaleDateString('vi-VN');
};

export default function ChatListScreen({ navigation }) {
  const dispatch = useDispatch();
  const { conversations, loadingConversations } = useSelector((state) => state.chat);
  const user = useSelector((state) => state.auth.user);
  const [searchText, setSearchText] = useState('');
  const [filteredConversations, setFilteredConversations] = useState(conversations);
  const searchRef = useRef(null);

  const loadData = useCallback(() => {
    dispatch(fetchConversations());
    dispatch(fetchChatUnreadCount());
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSearchChange = (text) => {
    setSearchText(text);
  };

  const handleAvatarPress = () => {
    navigation.navigate('UserProfile', { userId: user?._id || user?.id });
  };

  const computedConversations = useMemo(() => {
    if (!searchText.trim()) return conversations;
    return conversations.filter((item) => {
      const peerName = item.peer?.name || 'Thành viên VibeSport';
      const lastMessage = item.lastMessage || '';
      return (
        peerName.toLowerCase().includes(searchText.toLowerCase()) ||
        lastMessage.toLowerCase().includes(searchText.toLowerCase())
      );
    });
  }, [conversations, searchText]);

  const renderItem = ({ item }) => {
    const peer = item.peer;
    const peerName = peer?.name || 'Thành viên VibeSport';

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('ChatDetail', {
            conversationId: item._id,
            peer,
          })
        }
      >
        {peer?.picture ? (
          <Image source={{ uri: fixMediaUrl(peer.picture) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: getAvatarColor(peerName) }]}> 
            <Text style={styles.avatarText}>{getInitials(peerName)}</Text>
          </View>
        )}

        <View style={styles.conversationBody}>
          <View style={styles.conversationTopRow}>
            <Text style={styles.peerName} numberOfLines={1}>
              {peerName}
            </Text>
            <Text style={styles.timeText}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.conversationBottomRow}>
            <Text style={[styles.lastMessage, item.unreadCount > 0 && styles.lastMessageUnread]} numberOfLines={1}>
              {item.lastMessage || 'Bắt đầu trò chuyện'}
            </Text>
            {item.unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.headerTop}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerSmall}>Chat VibeSport</Text>
            <Text style={styles.headerTitle}>Tin nhắn</Text>
          </View>
          <TouchableOpacity style={styles.profileAvatarWrapper} onPress={handleAvatarPress} activeOpacity={0.8}>
            {user?.picture ? (
              <Image source={{ uri: fixMediaUrl(user.picture) }} style={styles.profileAvatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: getAvatarColor(user?.name) }]}> 
                <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#64748B" />
          <TextInput
            ref={searchRef}
            value={searchText}
            onChangeText={handleSearchChange}
            placeholder="Tìm kiếm cuộc hội thoại"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      </View>

      {loadingConversations && conversations.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0b74ff" />
        </View>
      ) : (
        <FlatList
          data={computedConversations}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={loadingConversations} onRefresh={loadData} tintColor="#0b74ff" />
          }
          contentContainerStyle={computedConversations.length === 0 ? styles.emptyList : styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Không có đoạn chat nào</Text>
              <Text style={styles.emptySubtitle}>
                Bắt đầu chat với bạn bè để xem ở đây.
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  listContent: {
    paddingBottom: 24,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerTop: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerSmall: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  profileAvatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#111827',
  },
  conversationBody: {
    flex: 1,
    marginLeft: 12,
  },
  conversationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  peerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  conversationBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
  },
  lastMessageUnread: {
    color: '#111827',
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
