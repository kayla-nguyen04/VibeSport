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
import { getPostLikesRequest, searchPostsRequest } from '../services/postApi';
import { API_BASE_URL } from '../components/constants/api';
import { Screen } from '../components/Screen';
import {
  LikesModal,
  ReactionsPreview,
  VibeReactionIcon,
  VIBE_REACTION,
} from '../components/PostReactions';
import { ReportModal } from '../components/ReportModal';
import { PostImages } from '../components/PostImages';

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

const getTagDisplayName = (tagName) => {
  switch (tagName) {
    case 'Bóng đá': return 'Bóng đá ⚽';
    case 'Pickleball': return 'Pickleball 🎾';
    case 'Cầu lông': return 'Cầu lông 🏸';
    default: return tagName;
  }
};

const formatCount = (count) => {
  if (!count) return '0';
  if (count >= 1000) {
    const kValue = (count / 1000).toFixed(1);
    return kValue.endsWith('.0') ? `${Math.floor(count / 1000)} K` : `${kValue} K`;
  }
  return String(count);
};

const isPostOwner = (currentUser, post) => {
  if (!currentUser || !post || !post.userId) return false;
  const currentUserId = currentUser._id || currentUser.id;
  const postAuthorId = post.userId._id || post.userId.id || (typeof post.userId === 'string' ? post.userId : null);
  return !!currentUserId && !!postAuthorId && String(currentUserId) === String(postAuthorId);
};

const navigateToProfile = (navigation, currentUser, userId, onGoToProfile) => {
  const targetUserId = userId ? (typeof userId === 'object' ? (userId._id || userId.id) : userId) : null;
  if (!targetUserId) {
    Alert.alert('Thông báo', 'Tài khoản này không tồn tại hoặc đã bị xóa.');
    return;
  }

  const myId = currentUser?._id || currentUser?.id;
  if (myId && String(myId) === String(targetUserId)) {
    if (onGoToProfile) {
      onGoToProfile();
    } else {
      navigation.navigate('Home', { screen: 'ProfileTab' });
    }
  } else {
    navigation.navigate('UserProfile', { userId: targetUserId });
  }
};

export function CommunityFeedScreen({ navigation, onGoToProfile }) {
  const dispatch = useDispatch();
  const { posts, loading, refreshing, hasMore, page, activeTag, error } = useSelector((state) => state.posts);
  const { unreadCount } = useSelector((state) => state.notifications);
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const [optionsPost, setOptionsPost] = useState(null);
  const [catalogTags, setCatalogTags] = useState([]);
  const [likesPost, setLikesPost] = useState(null);
  const [likesSummary, setLikesSummary] = useState(null);
  const [likesLoading, setLikesLoading] = useState(false);
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
  const initialFeedRequestKeyRef = useRef('');

  useEffect(() => {
    if (error) {
      console.error('Redux posts fetch error:', error);
    }
  }, [error]);

  useEffect(() => {
    getTagsRequest(token, 'sport')
      .then((res) => setCatalogTags(res.data || []))
      .catch((err) => {
        console.error('getTagsRequest failed:', err);
        setCatalogTags([]);
      });
  }, [token]);

  useEffect(() => {
    if (token) {
      dispatch(fetchUnreadCount());
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (!token) {
      initialFeedRequestKeyRef.current = '';
      return;
    }

    const requestKey = `${activeTag || 'all'}:1`;
    if (initialFeedRequestKeyRef.current === requestKey) {
      return;
    }

    initialFeedRequestKeyRef.current = requestKey;
    dispatch(fetchPosts({ page: 1, limit: 10, tag: activeTag }));
  }, [dispatch, activeTag, token]);

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
    if (!token || loading || refreshing) {
      return;
    }
    initialFeedRequestKeyRef.current = `${activeTag || 'all'}:1`;
    dispatch(fetchPosts({ page: 1, limit: 10, tag: activeTag }));
  }, [dispatch, activeTag, loading, refreshing, token]);

  const handleLoadMore = () => {
    if (!token || loading || refreshing || !hasMore) {
      return;
    }
    dispatch(fetchPosts({ page: page + 1, limit: 10, tag: activeTag }));
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

    dispatch(likePost({ postId: post._id, reactionType: 'vibe' }));
  };

  const handleOpenLikes = async (post) => {
    setLikesPost(post);
    setLikesSummary(null);
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
      const authorName = post.userId?.name || 'Ai đó';
      const content = post.content?.trim() || '';
      const mediaLine = post.mediaUrls?.length > 0 ? `\n\nXem ảnh: ${fixMediaUrl(post.mediaUrls[0])}` : '';
      const message = content
        ? `${authorName} chia sẻ trên VibeSport: "${content}"${mediaLine}`
        : `${authorName} đã chia sẻ một bài viết trên VibeSport.${mediaLine}`;

      await Share.share(
        { title: 'VibeSport', message },
        { dialogTitle: 'Chia sẻ bài viết' },
      );
    } catch (error) {
      if (error?.message !== 'User did not share') {
        console.warn('Share error:', error?.message);
      }
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
    const isSelf = isPostOwner(user, item);
    const rawName = item.userId?.name || 'Thành viên VibeSport';
    const postOwnerName = (rawName === 'Long Nguyên' || rawName === 'Long Nguyễn' || rawName === 'Long') ? 'Longabc' : rawName;
    const firstLetter = postOwnerName ? postOwnerName.charAt(0).toUpperCase() : '?';

    return (
      <View style={styles.postCard}>
        {/* Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={() => navigateToProfile(navigation, user, item.userId, onGoToProfile)}
            activeOpacity={0.8}
          >
            {item.userId?.picture ? (
              <Image source={{ uri: item.userId.picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>{firstLetter}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.postInfo}>
            <View style={styles.nameRow}>
              <TouchableOpacity
                onPress={() => navigateToProfile(navigation, user, item.userId, onGoToProfile)}
                activeOpacity={0.7}
              >
                <Text style={styles.userName}>{postOwnerName}</Text>
              </TouchableOpacity>
              {!isSelf && (
                <Ionicons name="people" size={16} color="#FF5F3D" style={{ marginLeft: 4 }} />
              )}
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
            <Ionicons name="ellipsis-horizontal" size={20} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Clickable Content & Media Area */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
        >
          {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}

          {item.mediaUrls && item.mediaUrls.length > 0 && (
            <PostImages
              images={item.mediaUrls.map(fixMediaUrl)}
            />
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Actions Bar */}
        <View style={styles.actionsBar}>
          <TouchableOpacity
            onPress={() => handleLike(item)}
            style={styles.actionBtn}
          >
            {item.isLiked ? (
              <VibeReactionIcon size={20} />
            ) : (
              <Ionicons name="heart-outline" size={20} color="#7C8190" />
            )}
            <Text style={[styles.actionText, item.isLiked && { color: VIBE_REACTION.color }]}>
              {formatCount(item.likesCount)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
            style={styles.actionBtn}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#7C8190" />
            <Text style={styles.actionText}>{formatCount(item.commentsCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleShare(item)} style={styles.actionBtn}>
            <Ionicons name="share-social-outline" size={20} color="#7C8190" />
            <Text style={styles.actionText}>{formatCount(item.sharesCount || 0)}</Text>
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
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/logovibe_tachnen.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>
                Vibe<Text style={styles.logoHighlight}>Sport</Text>
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton} onPress={handleOpenSearch}>
                <Ionicons name="search-outline" size={26} color="#1F2937" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Notification')}
              >
                <View style={{ position: 'relative' }}>
                  <Ionicons name="notifications-outline" size={26} color="#1F2937" />
                  {unreadCount > 0 && (
                    <View style={styles.notificationDot} />
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
                <Text style={[styles.filterChipText, searchActiveTag === tag.name && styles.filterChipTextActive]}>
                  {getTagDisplayName(tag.name)}
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
                  <Text
                    style={[styles.filterChipText, activeTag === tag.name && styles.filterChipTextActive]}
                  >
                    {getTagDisplayName(tag.name)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

          <View style={styles.bannerContainer}>
            <View style={styles.bannerCard}>
              <View style={styles.greetingRow}>
                <Text style={styles.greetingText}>Xin chào</Text>
                <View style={styles.userBadge}>
                  <Text style={styles.userBadgeText}>{(user?.name === 'Long Nguyên' || user?.name === 'Long Nguyễn' || user?.name === 'Long') ? 'Longabc' : (user?.name || 'Thành viên')}</Text>
                </View>
                <MaterialCommunityIcons name="hand-wave-outline" size={24} color="#000000" style={{ marginLeft: 2 }} />
              </View>
              <Text style={styles.bannerSubtext}>Hôm nay bạn muốn chia sẻ gì?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('CreatePost')}
                style={styles.createPostBtn}
              >
                <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
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
            <Text style={styles.bottomSheetTitle}>Tùy chọn bài viết</Text>

            {optionsPost && (
              <>
                <TouchableOpacity
                  onPress={() => {
                    const post = optionsPost;
                    setOptionsPost(null);
                    handleToggleSave(post);
                  }}
                  style={styles.bottomSheetOption}
                >
                  <Text style={styles.bottomSheetOptionText}>
                    {optionsPost.isSaved ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
                  </Text>
                </TouchableOpacity>

                {isPostOwner(user, optionsPost) ? (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        const post = optionsPost;
                        setOptionsPost(null);
                        navigation.navigate('CreatePost', { editPost: post });
                      }}
                      style={styles.bottomSheetOption}
                    >
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
                    <Text style={[styles.bottomSheetOptionText, { color: '#EF4444' }]}>Báo cáo bài viết</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <LikesModal
        visible={likesPost !== null}
        loading={likesLoading}
        summary={likesSummary}
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
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: Platform.OS === 'ios' ? 8 : 16,
    marginBottom: 8,
    zIndex: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 36,
    height: 36,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2B3B52',
  },
  logoHighlight: {
    color: '#FF5F3D',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
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
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  userBadge: {
    backgroundColor: '#FF5F3D',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  userBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bannerSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  createPostBtn: {
    backgroundColor: '#FF5F3D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  createPostBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    backgroundColor: '#F3F4F6',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FF5F3D',
  },
  filterChipText: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FF5F3D',
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
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  followingBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  followingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
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
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  actionText: {
    fontSize: 13,
    color: '#7C8190',
    fontWeight: '500',
  },
  actionTextActive: {
    color: '#FF5F3D',
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
    backgroundColor: '#EF4444',
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  bottomSheetOption: {
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    alignItems: 'flex-start',
    paddingLeft: 24,
  },
  bottomSheetOptionText: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
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
    height: 44,
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
