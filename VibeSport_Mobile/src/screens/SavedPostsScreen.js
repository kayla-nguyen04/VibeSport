import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { fetchSavedPosts } from '../redux/postSlice';
import { API_BASE_URL } from '../components/constants/api.example';

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
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${diffDays} ngày trước`;
};

export default function SavedPostsScreen({ navigation }) {
  const dispatch = useDispatch();
  const {
    savedPosts,
    savedPostsLoading,
    savedPostsRefreshing,
    savedPostsError,
  } = useSelector((state) => state.posts);

  const loadSavedPosts = useCallback(() => {
    dispatch(fetchSavedPosts());
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadSavedPosts();
    }, [loadSavedPosts])
  );

  const renderSavedPost = ({ item }) => {
    const coverUrl = item.mediaUrls?.[0] ? fixMediaUrl(item.mediaUrls[0]) : null;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
        style={styles.postItem}
      >
        <View style={styles.postTextCol}>
          <Text style={styles.postTitle} numberOfLines={2}>
            {item.content || 'Bài viết không có nội dung'}
          </Text>
          <Text style={styles.postMeta} numberOfLines={1}>
            {item.userId?.name || 'Thành viên VibeSport'} · {formatTime(item.createdAt)}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="heart-outline" size={14} color="#94A3B8" />
              <Text style={styles.statText}>{item.likesCount || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble-outline" size={14} color="#94A3B8" />
              <Text style={styles.statText}>{item.commentsCount || 0}</Text>
            </View>
          </View>
        </View>

        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="newspaper-outline" size={24} color="#CBD5E1" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={styles.safeArea}>
      <ScreenHeader style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bài viết đã lưu</Text>
        <View style={{ width: 36 }} />
      </ScreenHeader>

      {savedPostsLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.centerText}>Đang tải bài viết đã lưu...</Text>
        </View>
      ) : (
        <FlatList
          data={savedPosts}
          keyExtractor={(item) => item._id}
          renderItem={renderSavedPost}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={savedPostsRefreshing}
              onRefresh={loadSavedPosts}
              colors={['#FF6B35']}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="bookmark-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Chưa có bài viết đã lưu</Text>
              <Text style={styles.emptyText}>Nhấn dấu ba chấm trên bài viết để lưu lại và xem sau.</Text>
            </View>
          }
          ListHeaderComponent={
            savedPostsError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{savedPostsError}</Text>
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  postItem: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#101828',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  postTextCol: {
    flex: 1,
    minHeight: 82,
    justifyContent: 'space-between',
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 21,
  },
  postMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748B',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  coverImage: {
    width: 86,
    height: 86,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  coverPlaceholder: {
    width: 86,
    height: 86,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerState: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
  },
});
