import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Share,
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
import { HeaderIconButton, EmptyState } from '../components/ProfileScreenComponents';
import { PostImages } from '../components/PostImages';
import { TagIcon } from '../components/TagIcon';
import { fetchPosts, deletePost, likePost, unlikePost } from '../redux/postSlice';
import { API_BASE_URL } from '../components/constants/api';
import { VibeReactionIcon, VIBE_REACTION } from '../components/PostReactions';
import { icon, primary, spacing } from '../theme';
import { styles as profileStyles } from './ProfileScreen.styles';

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

function fixMediaUrl(url) {
  if (!url) return url;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

function formatTime(dateString) {
  if (!dateString) return 'Vừa xong';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${diffDays} ngày trước`;
}

export default function ProfileManagementScreen({ navigation }) {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);
  const userId = user?.id || user?._id;

  // Lắng nghe dữ liệu tập trung từ Redux Store của hệ thống bài viết
  const { posts, page, hasMore, refreshing, loading } = useSelector((state) => state.posts);

  // Bộ lọc tối ưu chỉ lấy các bài đăng thuộc sở hữu của chính tài khoản hiện tại
  const myPosts = useMemo(() => {
    return posts.filter((post) => {
      const authorId = post.userId?._id || post.userId?.id || post.userId;
      return String(authorId) === String(userId);
    });
  }, [posts, userId]);

  // Hàm tải dữ liệu kết hợp phân trang
  const loadPostsData = useCallback(async ({ targetPage = 1 } = {}) => {
    if (!token || !userId) return;
    try {
      await dispatch(fetchPosts({ page: targetPage, limit: 10, tag: null, userId })).unwrap();
    } catch (error) {
      Alert.alert('⚠️ Lỗi kết nối', error?.message || error || 'Không thể tải dữ liệu bài viết.');
    }
  }, [dispatch, token, userId]);

  // Tự động reload tải lại trang 1 mỗi khi màn hình được Focus quay lại
  useFocusEffect(
    useCallback(() => {
      loadPostsData({ targetPage: 1 });
    }, [loadPostsData])
  );

  const handleRefresh = () => loadPostsData({ targetPage: 1 });

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadPostsData({ targetPage: page + 1 });
    }
  };

  // Nghiệp vụ Thích/Bỏ thích bài viết đồng bộ thời gian thực
  const handleToggleLike = useCallback((post) => {
    if (post.isLiked) {
      dispatch(unlikePost(post._id));
    } else {
      dispatch(likePost({ postId: post._id, reactionType: 'vibe' }));
    }
  }, [dispatch]);

  const handleOpenPostDetail = useCallback((post) => {
    navigation.navigate('PostDetail', { postId: post._id });
  }, [navigation]);

  // Nghiệp vụ chia sẻ bài viết sử dụng thư viện Share gốc của React Native giống trang chủ
  const handleSharePost = useCallback(async (post) => {
    try {
      const authorName = user?.name || 'Thành viên VibeSport';
      const content = post.content?.trim() || '';
      const mediaLine = post.mediaUrls?.length > 0 ? `\n\nXem ảnh: ${fixMediaUrl(post.mediaUrls[0])}` : '';
      const message = content
        ? `${authorName} chia sẻ trên VibeSport: "${content}"${mediaLine}`
        : `${authorName} đã chia sẻ một bài viết trên VibeSport.${mediaLine}`;

      await Share.share(
        { title: 'VibeSport', message },
        { dialogTitle: 'Chia sẻ bài viết' }
      );
    } catch (error) {
      if (error?.message !== 'User did not share') {
        console.warn('Share error:', error?.message);
      }
    }
  }, [user]);

  // Nghiệp vụ Xóa bài viết an toàn 2 lớp kết hợp bọc lỗi hệ thống
  const handleOpenPostMenu = useCallback((post) => {
    Alert.alert(
      'Quản lý bài đăng',
      'Bạn muốn thực hiện thao tác nào với bài viết này?',
      [
        {
          text: 'Sửa bài viết',
          onPress: () => navigation.navigate('CreatePost', { editPost: post }),
        },
        {
          text: 'Xóa bài viết vĩnh viễn',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Xác nhận hành động',
              'Bài viết sau khi xóa sẽ không thể khôi phục lại được.',
              [
                { text: 'Hủy', style: 'cancel' },
                {
                  text: 'Xóa bài viết',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await dispatch(deletePost(post._id)).unwrap();
                      Alert.alert('Thành công', 'Bài viết của bạn đã được xóa khỏi hệ thống.');
                    } catch (err) {
                      Alert.alert('Lỗi', err || 'Không thể tiến hành xóa bài viết.');
                    }
                  }
                }
              ]
            );
          }
        },
        { text: 'Hủy', style: 'cancel' }
      ]
    );
  }, [dispatch, navigation]);

  const renderPostItem = ({ item }) => {
    const authorName = user?.name || 'Thành viên VibeSport';
    const displayTags = item.tags?.length ? item.tags : item.sportType ? [item.sportType] : [];

    return (
      <View style={localStyles.postCard}>
        {/* Header bài đăng */}
        <View style={localStyles.postHeader}>
          {user?.picture ? (
            <Image source={{ uri: fixMediaUrl(user.picture) }} style={localStyles.avatar} />
          ) : (
            <View style={[localStyles.avatarPlaceholder, { backgroundColor: getAvatarColor(authorName) }]}>
              <Text style={localStyles.avatarPlaceholderText}>
                {authorName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={localStyles.postInfo}>
            <View style={localStyles.nameRow}>
              <Text style={localStyles.userName}>{authorName}</Text>
              <View style={localStyles.tagRow}>
                {displayTags.map((tagName, index) => (
                  <View key={`${item._id}-${index}`} style={localStyles.sportBadge}>
                    <TagIcon color="#FF6B35" size={11} tagName={tagName} />
                    <Text style={localStyles.sportBadgeText}>{tagName}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={localStyles.timeText}>
              {formatTime(item.createdAt)}
              {item.location ? ` • ở ${item.location}` : ''}
            </Text>
          </View>

          <TouchableOpacity onPress={() => handleOpenPostMenu(item)} style={localStyles.moreOptionsBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#7C8190" />
          </TouchableOpacity>
        </View>

        {/* Nội dung bài viết */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => handleOpenPostDetail(item)}>
          {item.content ? <Text style={localStyles.postContent}>{item.content}</Text> : null}

          {item.mediaUrls && item.mediaUrls.length > 0 && (
            <View style={localStyles.mediaContainer}>
              <PostImages images={item.mediaUrls.map(fixMediaUrl)} />
            </View>
          )}
        </TouchableOpacity>

        {/* Khu vực thống kê tương tác */}
        {(item.likesCount > 0 || item.commentsCount > 0) ? (
          <View style={localStyles.engagementRow}>
            <View style={localStyles.likesPreview}>
              <Ionicons name="heart" size={14} color="#EF4444" />
              <Text style={localStyles.engagementText}>{item.likesCount || 0} lượt thích</Text>
            </View>
            {item.commentsCount > 0 ? (
              <Text style={localStyles.engagementText}>{item.commentsCount} bình luận</Text>
            ) : null}
          </View>
        ) : null}

        <View style={localStyles.divider} />

        {/* Thanh công cụ tương tác */}
        <View style={localStyles.actionsBar}>
          <TouchableOpacity onPress={() => handleToggleLike(item)} style={localStyles.actionBtn}>
            {item.isLiked ? (
              <VibeReactionIcon size={20} />
            ) : (
              <Ionicons name="heart-outline" size={20} color="#7C8190" />
            )}
            <Text style={[localStyles.actionText, item.isLiked && { color: VIBE_REACTION.color }]}>
              {item.isLiked ? VIBE_REACTION.label : 'Vibe'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleOpenPostDetail(item)} style={localStyles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={20} color="#7C8190" />
            <Text style={localStyles.actionText}>{item.commentsCount || 0} Bình luận</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleSharePost(item)} style={localStyles.actionBtn}>
            <Ionicons name="share-outline" size={20} color="#7C8190" />
            <Text style={localStyles.actionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Screen edges={['top', 'left', 'right']} style={profileStyles.screen}>
      <ScreenHeader style={profileStyles.headerBar}>
        <View style={profileStyles.headerSide}>
          <HeaderIconButton onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={spacing.xl} color={icon.dark} />
          </HeaderIconButton>
        </View>
        <Text style={profileStyles.headerTitle}>Bài viết của tôi</Text>
        <TouchableOpacity 
          style={localStyles.createPostIconBtn} 
          onPress={() => navigation.navigate('CreatePost')}
        >
          <Ionicons name="add-circle-outline" size={26} color="#FF6B35" />
        </TouchableOpacity>
      </ScreenHeader>

      <FlatList
        data={myPosts}
        keyExtractor={(item) => item._id}
        renderItem={renderPostItem}
        contentContainerStyle={profileStyles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primary.DEFAULT} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={profileStyles.centerState}>
              <ActivityIndicator size="large" color={primary.DEFAULT} />
            </View>
          ) : (
            <View style={{ paddingTop: spacing['5xl'] }}>
              <EmptyState iconName="document-text-outline" title="Bạn chưa đăng tải bài viết nào." loading={false} />
            </View>
          )
        }
        ListFooterComponent={
          loading && myPosts.length > 0 ? (
            <ActivityIndicator size="small" color={primary.DEFAULT} style={{ marginVertical: spacing.md }} />
          ) : null
        }
      />
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  createPostIconBtn: { padding: 4, width: 40, alignItems: 'flex-end' },
  postCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E7EB' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  postInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  userName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  tagRow: { flexDirection: 'row', gap: 4 },
  sportBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#FFF0EA' },
  sportBadgeText: { fontSize: 10, fontWeight: '700', color: '#FF6B35' },
  timeText: { marginTop: 2, fontSize: 11, color: '#64748B' },
  moreOptionsBtn: { padding: 4 },
  postContent: { marginTop: 10, fontSize: 14, color: '#1F2937', lineHeight: 20 },
  mediaContainer: { marginTop: 4 },
  engagementRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingHorizontal: 4 },
  engagementText: { fontSize: 12, color: '#64748B' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  actionsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 },
  actionText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
});