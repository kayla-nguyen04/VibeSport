import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPosts,
  likePost,
  unlikePost,
  deletePost,
  setActiveTag,
  savePost,
  unsavePost,
} from '../redux/postSlice';
import { fetchUnreadCount } from '../redux/notificationSlice';
import { TagIcon } from '../components/TagIcon';
import { getTagsRequest } from '../services/tagApi';
import { getPostLikesRequest,searchPostsRequest } from '../services/postApi';
import { API_BASE_URL } from '../components/constants/api.example';
import { Screen } from '../components/Screen';
import {
  LikesModal,
  ReactionPickerModal,
  ReactionsPreview,
  getReactionMeta,
} from '../components/PostReactions';
import { ReportModal } from '../components/ReportModal';

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[charCodeSum % AVATAR_COLORS.length];
};

// Fix URL ảnh khi IP server thay đổi
function fixMediaUrl(url) {
  if (!url) return url;
  // Thay thế bất kỳ IP:port cũ bằng API_BASE_URL hiện tại
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

export function CommunityFeedScreen({ navigation, onGoToProfile }) {
  const dispatch = useDispatch();
  const { posts, loading, refreshing, hasMore, page, activeTag } = useSelector((state) => state.posts);
  const { unreadCount } = useSelector((state) => state.notifications);
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const [optionsPost, setOptionsPost] = useState(null);
  const [catalogTags, setCatalogTags] = useState([]);
  const [reactionPickerPost, setReactionPickerPost] = useState(null);
  const [likesPost, setLikesPost] = useState(null);
  const [likesSummary, setLikesSummary] = useState(null);
  const [likesLoading, setLikesLoading] = useState(false);
  const [activeReactionFilter, setActiveReactionFilter] = useState('all');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [postToReport, setPostToReport] = useState(null);

  // ─── Search state ──────────────────────────────────────────────
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchActiveTag, setSearchActiveTag] = useState(null);
  const searchDebounceRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    getTagsRequest(token, 'sport')
      .then((res) => setCatalogTags(res.data || []))
      .catch(() => setCatalogTags([]));
  }, [token]);

  useEffect(() => {
    if (token) {
      dispatch(fetchUnreadCount());
    }
  }, [dispatch, token]);

  useEffect(() => {
    dispatch(fetchPosts({ page: 1, limit: 10, tag: activeTag }));
  }, [dispatch, activeTag]);

  // ─── Search logic ──────────────────────────────────────────────
  const executeSearch = useCallback((keyword, tag) => {
    if (!keyword.trim() && !tag) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchPostsRequest(keyword.trim(), tag, 1, 20, token)
      .then((res) => setSearchResults(res.data || []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, [token]);

  const handleSearchChange = (text) => {
    setSearchKeyword(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!text.trim() && !searchActiveTag) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(() => executeSearch(text, searchActiveTag), 400);
  };

  const handleSearchTagPress = (tagName) => {
    const nextTag = searchActiveTag === tagName ? null : tagName;
    setSearchActiveTag(nextTag);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    executeSearch(searchKeyword, nextTag);
  };

  const handleOpenSearch = () => {
    setIsSearchMode(true);
    setSearchKeyword('');
    setSearchResults([]);
    setSearchActiveTag(null);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleCloseSearch = () => {
    setIsSearchMode(false);
    setSearchKeyword('');
    setSearchResults([]);
    setSearchActiveTag(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  };

  const handleRefresh = useCallback(() => {
    dispatch(fetchPosts({ page: 1, limit: 10, tag: activeTag }));
  }, [dispatch, activeTag]);

  const handleLoadMore = () => {
    if (!loading && !refreshing && hasMore) {
      dispatch(fetchPosts({ page: page + 1, limit: 10, tag: activeTag }));
    }
  };

  const handleTagPress = (tagName) => {
    const nextTag = activeTag === tagName ? null : tagName;
    dispatch(setActiveTag(nextTag));
  };

  const handleLike = (post) => {
    if (post.isLiked) {
      dispatch(unlikePost(post._id));
      return;
    }

    dispatch(likePost({ postId: post._id, reactionType: 'like' }));
  };

  const handleSelectReaction = (reactionType) => {
    if (!reactionPickerPost) return;
    const post = reactionPickerPost;
    setReactionPickerPost(null);

    if (post.isLiked && post.reactionType === reactionType) {
      return;
    }

    dispatch(likePost({ postId: post._id, reactionType }));
  };

  const handleOpenLikes = async (post) => {
    setLikesPost(post);
    setLikesSummary(null);
    setActiveReactionFilter('all');
    setLikesLoading(true);

    try {
      const response = await getPostLikesRequest(post._id, token);
      setLikesSummary(response);
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tải danh sách cảm xúc.');
      setLikesPost(null);
    } finally {
      setLikesLoading(false);
    }
  };

  const handleToggleSave = (post) => {
    const action = post.isSaved ? unsavePost(post._id) : savePost(post._id);
    dispatch(action)
      .unwrap()
      .then(() => {
        Alert.alert(
          'Thành công',
          post.isSaved ? 'Đã bỏ lưu bài viết.' : 'Đã lưu bài viết.'
        );
      })
      .catch((err) => {
        Alert.alert('Lỗi', err?.error || 'Không thể cập nhật trạng thái lưu bài viết.');
      });
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

  const handleReportPost = (reason) => {
    setReportModalVisible(false);
    setPostToReport(null);
    Alert.alert('Thành công', 'Cảm ơn bạn đã gửi báo cáo. Chúng tôi sẽ xem xét bài viết này sớm nhất có thể!');
  };

  const handleMoreOptions = (post) => {
    Alert.alert(
      'Tùy chọn bài viết',
      'Chọn hành động bạn muốn thực hiện',
      [
        {
          text: 'Sửa bài viết',
          onPress: () => navigation.navigate('CreatePost', { editPost: post }),
        },
        {
          text: 'Xóa bài viết',
          style: 'destructive',
          onPress: () => handleDelete(post._id),
        },
        {
          text: 'Hủy',
          style: 'cancel',
        },
      ]
    );
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

  const renderTagBadge = (tagName, key) => (
    <TouchableOpacity
      key={key}
      onPress={() => handleTagPress(tagName)}
      style={[styles.sportBadge, activeTag === tagName && styles.sportBadgeActive]}
    >
      <TagIcon
        color={activeTag === tagName ? '#FFFFFF' : '#FF6B35'}
        size={12}
        tagName={tagName}
      />
      <Text style={[styles.sportBadgeText, activeTag === tagName && styles.sportBadgeTextActive]}>
        {tagName}
      </Text>
    </TouchableOpacity>
  );

  const renderPostItem = ({ item }) => {
    const isOwner = user && item.userId && (user.id === item.userId._id || user._id === item.userId._id);
    const displayTags = item.tags?.length ? item.tags : item.sportType ? [item.sportType] : [];
    const reactionMeta = getReactionMeta(item.reactionType);

    return (
      <View style={styles.postCard}>
      {/* Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={() => {
              const authorId = item.userId?._id || item.userId?.id;
              if (authorId) {
                navigation.navigate('UserProfile', { userId: authorId });
              }
            }}
            activeOpacity={0.8}
          >
            {item.userId?.picture ? (
              <Image source={{ uri: item.userId.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(item.userId?.name) }]}>
                <Text style={styles.avatarPlaceholderText}>
                  {item.userId?.name ? item.userId.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.postInfo}>
            <View style={styles.nameRow}>
              <TouchableOpacity
                onPress={() => {
                  const authorId = item.userId?._id || item.userId?.id;
                  if (authorId) navigation.navigate('UserProfile', { userId: authorId });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.userName}>{item.userId?.name || 'Thành viên VibeSport'}</Text>
              </TouchableOpacity>
              <View style={styles.tagRow}>
                {displayTags.map((tagName, index) => renderTagBadge(tagName, `${item._id}-${index}`))}
              </View>
            </View>
            <Text style={styles.timeText}>
              {formatTime(item.createdAt)}
              {item.location ? ` • ở ${item.location}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setOptionsPost(item)}
            style={styles.moreOptionsBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#7C8190" />
          </TouchableOpacity>
        </View>

        {/* Clickable Content & Media Area */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
        >
          {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}

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
        </TouchableOpacity>

        {(item.likesCount > 0 || item.commentsCount > 0) ? (
          <View style={styles.engagementRow}>
            <ReactionsPreview
              likesCount={item.likesCount || 0}
              topReactions={item.topReactions || []}
              onPress={() => handleOpenLikes(item)}
            />
            {item.commentsCount > 0 ? (
              <TouchableOpacity onPress={() => navigation.navigate('PostDetail', { postId: item._id })}>
                <Text style={styles.commentSummaryText}>{item.commentsCount} bình luận</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Actions Bar */}
        <View style={styles.actionsBar}>
          <TouchableOpacity
            onPress={() => handleLike(item)}
            onLongPress={() => setReactionPickerPost(item)}
            delayLongPress={220}
            style={styles.actionBtn}
          >
            {item.isLiked ? (
              <Text style={styles.actionEmoji}>{reactionMeta.emoji}</Text>
            ) : (
              <Ionicons name="heart-outline" size={20} color="#7C8190" />
            )}
            <Text
              style={[
                styles.actionText,
                item.isLiked && { color: reactionMeta.color },
              ]}
            >
              {item.isLiked ? reactionMeta.label : 'Thích'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
            style={styles.actionBtn}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#7C8190" />
            <Text style={styles.actionText}>{item.commentsCount || 0} Bình luận</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleShare(item)} style={styles.actionBtn}>
            <Ionicons name="share-outline" size={20} color="#7C8190" />
            <Text style={styles.actionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.safeArea}>
      {/* App Header */}
      <View style={styles.header}>
        {isSearchMode ? (
          // ─── Search mode header ──────────────────────────────────────
          <>
            <TouchableOpacity onPress={handleCloseSearch} style={styles.searchBackBtn}>
              <Ionicons name="arrow-back" size={22} color="#FF6B35" />
            </TouchableOpacity>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Tìm kiếm bài viết, tag, môn thể thao..."
                placeholderTextColor="#9CA3AF"
                value={searchKeyword}
                onChangeText={handleSearchChange}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {searchKeyword.length > 0 && Platform.OS !== 'ios' && (
                <TouchableOpacity onPress={() => handleSearchChange('')} style={styles.searchClearBtn}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          // ─── Normal header ──────────────────────────────────────────
          <>
            <Text style={styles.logoText}>
              Vibe<Text style={styles.logoHighlight}>Sport</Text>
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton} onPress={handleOpenSearch}>
                <Ionicons name="search-outline" size={24} color="#1F2937" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Notification')}
              >
                <View style={{ position: 'relative' }}>
                  <Ionicons name="notifications-outline" size={24} color="#1F2937" />
                  {unreadCount > 0 && (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Search tag filter: hiện khi đang search mode */}
      {isSearchMode && (
        <View style={styles.searchTagContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.searchTagRow}
          >
            <TouchableOpacity
              onPress={() => handleSearchTagPress(null)}
              style={[styles.filterChip, !searchActiveTag && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, !searchActiveTag && styles.filterChipTextActive]}>
                Tất cả
              </Text>
            </TouchableOpacity>
            {catalogTags.map((tag) => (
              <TouchableOpacity
                key={tag._id}
                onPress={() => handleSearchTagPress(tag.name)}
                style={[styles.filterChip, searchActiveTag === tag.name && styles.filterChipActive]}
              >
                <TagIcon
                  color={searchActiveTag === tag.name ? '#FF6B35' : '#374151'}
                  size={14}
                  tagName={tag.name}
                />
                <Text style={[styles.filterChipText, searchActiveTag === tag.name && styles.filterChipTextActive]}>
                  {tag.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={isSearchMode ? searchResults : posts}
        keyExtractor={(item) => item._id}
        renderItem={renderPostItem}
        onEndReached={isSearchMode ? null : handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          !isSearchMode ? (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#FF6B35']} />
          ) : undefined
        }
        ListHeaderComponent={
          isSearchMode ? null : (
            <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagFilterRow}
            >
              <TouchableOpacity
                onPress={() => handleTagPress(null)}
                style={[styles.filterChip, !activeTag && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, !activeTag && styles.filterChipTextActive]}>
                  Tất cả
                </Text>
              </TouchableOpacity>
              {catalogTags.map((tag) => (
                <TouchableOpacity
                  key={tag._id}
                  onPress={() => handleTagPress(tag.name)}
                  style={[styles.filterChip, activeTag === tag.name && styles.filterChipActive]}
                >
                  <TagIcon
                    color={activeTag === tag.name ? '#FF6B35' : '#374151'}
                    size={14}
                    tagName={tag.name}
                  />
                  <Text
                    style={[styles.filterChipText, activeTag === tag.name && styles.filterChipTextActive]}
                  >
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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
          </View>
          )
        }
        ListFooterComponent={
          (isSearchMode ? searchLoading : (loading && !refreshing)) ? (
            <ActivityIndicator size="small" color="#FF6B35" style={styles.footerLoader} />
          ) : null
        }
        ListEmptyComponent={
          isSearchMode ? (
            !searchLoading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>
                  {searchKeyword.length > 0 || searchActiveTag
                    ? 'Không tìm thấy bài viết nào phù hợp.'
                    : 'Nhập từ khóa hoặc chọn tag để tìm kiếm.'}
                </Text>
              </View>
            ) : null
          ) : (
            !loading && !refreshing ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="newspaper-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>Chưa có bài đăng nào. Hãy là người đầu tiên chia sẻ!</Text>
              </View>
            ) : null
          )
        }
      />

      {/* Bottom Sheet Modal for options */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={optionsPost !== null}
        onRequestClose={() => setOptionsPost(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setOptionsPost(null)}
          style={styles.modalOverlay}
        >
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>TÙY CHỌN BÀI VIẾT</Text>

            {optionsPost ? (
              <TouchableOpacity
                onPress={() => {
                  const post = optionsPost;
                  setOptionsPost(null);
                  handleToggleSave(post);
                }}
                style={styles.bottomSheetOption}
              >
                <Ionicons
                  name={optionsPost.isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color="#FF6B35"
                />
                <Text style={[styles.bottomSheetOptionText, { color: '#FF6B35' }]}>
                  {optionsPost.isSaved ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
                </Text>
              </TouchableOpacity>
            ) : null}
            
            {optionsPost && user && (user.id === optionsPost.userId?._id || user._id === optionsPost.userId?._id) ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    const post = optionsPost;
                    setOptionsPost(null);
                    navigation.navigate('CreatePost', { editPost: post });
                  }}
                  style={styles.bottomSheetOption}
                >
                  <Ionicons name="pencil-outline" size={20} color="#374151" />
                  <Text style={styles.bottomSheetOptionText}>Sửa bài viết</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    const post = optionsPost;
                    setOptionsPost(null);
                    handleDelete(post._id);
                  }}
                  style={[styles.bottomSheetOption, { borderBottomWidth: 0 }]}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={[styles.bottomSheetOptionText, { color: '#EF4444' }]}>Xóa bài viết</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  const post = optionsPost;
                  setOptionsPost(null);
                  setPostToReport(post);
                  setReportModalVisible(true);
                }}
                style={[styles.bottomSheetOption, { borderBottomWidth: 0 }]}
              >
                <Ionicons name="flag-outline" size={20} color="#EF4444" />
                <Text style={[styles.bottomSheetOptionText, { color: '#EF4444' }]}>Báo cáo bài viết</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <ReactionPickerModal
        visible={reactionPickerPost !== null}
        onClose={() => setReactionPickerPost(null)}
        onSelect={handleSelectReaction}
      />

      <LikesModal
        visible={likesPost !== null}
        loading={likesLoading}
        summary={likesSummary}
        activeFilter={activeReactionFilter}
        onChangeFilter={setActiveReactionFilter}
        onClose={() => setLikesPost(null)}
      />

      <ReportModal
        visible={reportModalVisible}
        onClose={() => {
          setReportModalVisible(false);
          setPostToReport(null);
        }}
        onSelectReason={handleReportPost}
      />
    </Screen>
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
    zIndex: 10,
    elevation: 10,
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
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
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
    flexWrap: 'wrap',
    gap: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagFilterRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#FFF0EA',
    borderColor: '#FF6B35',
  },
  filterChipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FF6B35',
  },
  activeFilterBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeFilterText: {
    color: '#C2410C',
    fontWeight: '600',
    fontSize: 13,
  },
  clearFilterText: {
    color: '#FF6B35',
    fontWeight: '700',
    fontSize: 13,
  },
  userName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0EA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sportBadgeActive: {
    backgroundColor: '#FF6B35',
  },
  sportBadgeText: {
    color: '#FF6B35',
    fontSize: 11,
    fontWeight: '600',
  },
  sportBadgeTextActive: {
    color: '#FFFFFF',
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
  moreOptionsBtn: {
    padding: 8,
    marginRight: -4,
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
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
    marginTop: 10,
  },
  commentSummaryText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
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
  actionEmoji: {
    fontSize: 18,
    width: 20,
    textAlign: 'center',
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
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  bottomSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  bottomSheetOptionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  bottomSheetCancelBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  bottomSheetCancelText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '700',
  },

  // ─── Search styles ─────────────────────────────────────────────
  searchBackBtn: {
    padding: 6,
    marginRight: 4,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 2,
    marginLeft: 4,
  },
  searchTagContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    height: 52,
    justifyContent: 'center',
  },
  searchTagRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },

  // ─── Search result header ───────────────────────────────────────
  searchResultHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchResultCount: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },

  // ─── Suggestion Dropdown ────────────────────────────────────────
  suggestionOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 999,
    paddingBottom: 6,
  },
  suggSection: {
    paddingTop: 2,
  },
  suggSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  suggRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  suggTagIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggTagText: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  suggAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E5E7EB',
  },
  suggAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggAvatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  suggUserInfo: {
    flex: 1,
    gap: 2,
  },
  suggUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  suggUserSport: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  suggDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    marginVertical: 2,
  },
  suggSearchAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  suggSearchAllText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
});
