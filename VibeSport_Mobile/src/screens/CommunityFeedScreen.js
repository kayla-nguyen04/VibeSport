import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPosts, likePost, commentPost, deletePost } from '../redux/postSlice';
import { API_BASE_URL } from '../components/constants/api';

// Fix URL ảnh khi IP server thay đổi
function fixMediaUrl(url) {
  if (!url) return url;
  // Thay thế bất kỳ IP:port cũ bằng API_BASE_URL hiện tại
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

export function CommunityFeedScreen({ navigation, onGoToProfile }) {
  const dispatch = useDispatch();
  const { posts, loading, refreshing, hasMore, page } = useSelector((state) => state.posts);
  const user = useSelector((state) => state.auth.user);
  
  const [commentingPostId, setCommentingPostId] = useState(null);
  const [commentText, setCommentText] = useState('');

  // Initial load
  useEffect(() => {
    dispatch(fetchPosts({ page: 1, limit: 10 }));
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchPosts({ page: 1, limit: 10 }));
  }, [dispatch]);

  const handleLoadMore = () => {
    if (!loading && !refreshing && hasMore) {
      dispatch(fetchPosts({ page: page + 1, limit: 10 }));
    }
  };

  const handleLike = (postId) => {
    dispatch(likePost(postId));
  };

  const handleShare = async (post) => {
    try {
      await Share.share({
        message: `${post.userId?.name || 'Ai đó'} chia sẻ trên VibeSport: "${post.content}"${
          post.mediaUrls?.length > 0 ? `\n\nXem ảnh: ${post.mediaUrls[0]}` : ''
        }`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCommentSubmit = (postId) => {
    if (!commentText.trim()) return;
    dispatch(commentPost({ postId, content: commentText.trim() }))
      .unwrap()
      .then(() => {
        setCommentText('');
        setCommentingPostId(null);
        Alert.alert('Thành công', 'Đã gửi bình luận của bạn!');
      })
      .catch((err) => {
        Alert.alert('Lỗi', err || 'Không thể gửi bình luận');
      });
  };

  const handleDelete = (postId) => {
    Alert.alert('Xóa bài viết', 'Bạn có chắc chắn muốn xóa bài viết này không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          dispatch(deletePost(postId))
            .unwrap()
            .then(() => {
              Alert.alert('Thành công', 'Đã xóa bài viết.');
            })
            .catch((err) => {
              Alert.alert('Lỗi', err || 'Không thể xóa bài viết');
            });
        },
      },
    ]);
  };

  const formatTime = (dateString) => {
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

  const renderPostItem = ({ item }) => {
    const isOwner = user && item.userId && user.id === item.userId._id;

    return (
      <View style={styles.postCard}>
      {/* Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={() => {
              if (onGoToProfile) {
                onGoToProfile();
              }
            }}
            activeOpacity={0.8}
          >
            <Image
              source={
                item.userId?.picture
                  ? { uri: item.userId.picture }
                  : { uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }
              }
              style={styles.avatar}
            />
          </TouchableOpacity>
          <View style={styles.postInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{item.userId?.name || 'Thành viên VibeSport'}</Text>
              {item.sportType && (
                <View style={styles.sportBadge}>
                  <Text style={styles.sportBadgeText}>{item.sportType}</Text>
                </View>
              )}
            </View>
            <Text style={styles.timeText}>
              {formatTime(item.createdAt)}
              {item.location ? ` • ở ${item.location}` : ''}
            </Text>
          </View>
          {isOwner && (
            <View style={styles.ownerActions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('CreatePost', { editPost: item })}
                style={styles.editButton}
              >
                <Ionicons name="pencil-outline" size={18} color="#3B82F6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Content */}
        {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}

        {/* Media Grid */}
        {item.mediaUrls && item.mediaUrls.length > 0 && (
          <View style={styles.mediaContainer}>
            {item.mediaUrls.map((url, index) => (
              <Image
                key={index}
                source={{ uri: fixMediaUrl(url) }}
                style={styles.postMedia}
                resizeMode="cover"
              />
            ))}
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Actions Bar */}
        <View style={styles.actionsBar}>
          <TouchableOpacity onPress={() => handleLike(item._id)} style={styles.actionBtn}>
            <Ionicons
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={item.isLiked ? '#EF4444' : '#7C8190'}
            />
            <Text style={[styles.actionText, item.isLiked && styles.likedText]}>
              {item.likesCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setCommentingPostId(commentingPostId === item._id ? null : item._id);
              setCommentText('');
            }}
            style={styles.actionBtn}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#7C8190" />
            <Text style={styles.actionText}>{item.commentsCount || 0} bình luận</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleShare(item)} style={styles.actionBtn}>
            <Ionicons name="share-outline" size={20} color="#7C8190" />
            <Text style={styles.actionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>

        {/* Comment Input Overlay */}
        {commentingPostId === item._id && (
          <View style={styles.commentInputRow}>
            <TextInput
              placeholder="Viết bình luận..."
              placeholderTextColor="#9CA3AF"
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity
              onPress={() => handleCommentSubmit(item._id)}
              style={styles.sendCommentBtn}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* App Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>
          Vibe<Text style={styles.logoHighlight}>Sport</Text>
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="search-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderPostItem}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#FF6B35']} />
        }
        ListHeaderComponent={
          <View style={styles.bannerContainer}>
            <View style={styles.bannerCard}>
              <Text style={styles.bannerGreeting}>
                Xin chào {user?.name || 'Thành viên'} 👋
              </Text>
              <Text style={styles.bannerSubtext}>Hôm nay bạn muốn chia sẻ gì?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('CreatePost')}
                style={styles.createPostBtn}
              >
                <MaterialCommunityIcons name="pencil-box-outline" size={20} color="#FFFFFF" />
                <Text style={styles.createPostBtnText}>Đăng bài lên cộng đồng</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListFooterComponent={
          loading && !refreshing ? (
            <ActivityIndicator size="small" color="#FF6B35" style={styles.footerLoader} />
          ) : null
        }
        ListEmptyComponent={
          !loading && !refreshing ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Chưa có bài đăng nào. Hãy là người đầu tiên chia sẻ!</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  logoHighlight: {
    color: '#FF6B35',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  bannerContainer: {
    padding: 16,
  },
  bannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bannerGreeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  bannerSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },
  createPostBtn: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  createPostBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  postInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sportBadge: {
    backgroundColor: '#FFF0EA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sportBadgeText: {
    color: '#FF6B35',
    fontSize: 11,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
  editButton: {
    padding: 4,
  },
  ownerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postContent: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginTop: 12,
  },
  mediaContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    gap: 8,
  },
  postMedia: {
    width: '100%',
    height: 200,
    backgroundColor: '#E5E7EB',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 13,
    color: '#7C8190',
    fontWeight: '500',
  },
  likedText: {
    color: '#EF4444',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
  },
  sendCommentBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
  },
  footerLoader: {
    marginVertical: 16,
  },
});
