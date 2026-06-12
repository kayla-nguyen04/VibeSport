import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSelector, useDispatch } from 'react-redux';
import {
  getPostByIdRequest,
  commentPostRequest,
  getPostLikesRequest,
  deletePostRequest,
} from '../services/postApi';
import { API_BASE_URL } from '../components/constants/api';
import {
  likePost as likePostInFeed,
  unlikePost as unlikePostInFeed,
  deletePost as deletePostInFeed,
  savePost as savePostInFeed,
  unsavePost as unsavePostInFeed,
  updateCommentCount as updateCommentCountInFeed,
  setActiveTag,
} from '../redux/postSlice';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  LikesModal,
  ReactionPickerModal,
  ReactionsPreview,
  getReactionMeta,
} from '../components/PostReactions';

function fixMediaUrl(url) {
  if (!url) return url;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[charCodeSum % AVATAR_COLORS.length];
};

export default function PostDetailScreen({ route, navigation }) {
  const dispatch = useDispatch();
  const { postId } = route.params;
  const currentUser = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [expandedComments, setExpandedComments] = useState({});
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [likesVisible, setLikesVisible] = useState(false);
  const [likesSummary, setLikesSummary] = useState(null);
  const [likesLoading, setLikesLoading] = useState(false);
  const [activeReactionFilter, setActiveReactionFilter] = useState('all');

  const toggleExpandComment = (commentId) => {
    setExpandedComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const loadPostDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPostByIdRequest(postId, token);
      if (res?.success && res?.data) {
        setPost(res.data);
        setComments(res.data.comments || []);
      } else {
        Alert.alert('Lỗi', 'Không lấy được thông tin chi tiết bài viết');
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Có lỗi xảy ra khi tải bài viết');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [postId, token, navigation]);

  useEffect(() => {
    loadPostDetails();
  }, [loadPostDetails]);

  const applyPostReaction = (payload) => {
    setPost((prev) => prev ? ({
      ...prev,
      isLiked: payload.isLiked,
      reactionType: payload.reactionType,
      likesCount: payload.likesCount,
      topReactions: payload.topReactions,
    }) : prev);
  };

  const handleReactToPost = async (reactionType) => {
    if (!post) return;

    const previousPost = post;
    setPost((prev) => prev ? ({
      ...prev,
      isLiked: true,
      reactionType,
      likesCount: (prev.likesCount || 0) + (prev.isLiked ? 0 : 1),
      topReactions: [reactionType, ...(prev.topReactions || []).filter((item) => item !== reactionType)].slice(0, 2),
    }) : prev);

    try {
      const response = await dispatch(likePostInFeed({ postId: post._id, reactionType })).unwrap();
      applyPostReaction(response);
    } catch (err) {
      setPost(previousPost);
      Alert.alert('Lỗi', err?.error || 'Không thể gửi cảm xúc. Thử lại sau.');
    }
  };

  const handleUnlikePost = async () => {
    if (!post) return;

    const previousPost = post;
    setPost((prev) => prev ? ({
      ...prev,
      isLiked: false,
      reactionType: null,
      likesCount: Math.max(0, (prev.likesCount || 0) - (prev.isLiked ? 1 : 0)),
    }) : prev);

    try {
      const response = await dispatch(unlikePostInFeed(post._id)).unwrap();
      applyPostReaction(response);
    } catch (err) {
      setPost(previousPost);
      Alert.alert('Lỗi', err?.error || 'Không thể bỏ cảm xúc. Thử lại sau.');
    }
  };

  const handleLikePost = () => {
    if (!post) return;
    if (post.isLiked) {
      handleUnlikePost();
      return;
    }
    handleReactToPost('like');
  };

  const handleSelectReaction = (reactionType) => {
    setReactionPickerVisible(false);
    if (!post || (post.isLiked && post.reactionType === reactionType)) return;
    handleReactToPost(reactionType);
  };

  const handleOpenLikes = async () => {
    if (!post) return;

    setLikesVisible(true);
    setLikesSummary(null);
    setActiveReactionFilter('all');
    setLikesLoading(true);

    try {
      const response = await getPostLikesRequest(post._id, token);
      setLikesSummary(response);
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tải danh sách cảm xúc.');
      setLikesVisible(false);
    } finally {
      setLikesLoading(false);
    }
  };

  const handleToggleSavePost = async () => {
    if (!post) return;

    const previousPost = post;
    const shouldSave = !post.isSaved;
    setPost((prev) => prev ? ({ ...prev, isSaved: shouldSave }) : prev);

    try {
      if (shouldSave) {
        await dispatch(savePostInFeed(post._id)).unwrap();
      } else {
        await dispatch(unsavePostInFeed(post._id)).unwrap();
      }
      Alert.alert('Thành công', shouldSave ? 'Đã lưu bài viết.' : 'Đã bỏ lưu bài viết.');
    } catch (err) {
      setPost(previousPost);
      Alert.alert('Lỗi', err?.error || 'Không thể cập nhật trạng thái lưu bài viết.');
    }
  };

  const handleShare = async () => {
    if (!post) return;
    try {
      await Share.share({
        message: `${post.userId?.name || 'Ai đó'} chia sẻ trên VibeSport: "${post.content}"${
          post.mediaUrls?.length > 0 ? `\n\nXem ảnh: ${fixMediaUrl(post.mediaUrls[0])}` : ''
        }`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleTakeCameraPhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền sử dụng camera để chụp ảnh.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
      }
    } catch (err) {
      console.error('Camera launch error:', err);
      Alert.alert('Lỗi', 'Không thể mở camera trên thiết bị.');
    }
  };

  const handleSelectFromLibrary = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh để chọn ảnh.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
      }
    } catch (err) {
      console.error('Library launch error:', err);
      Alert.alert('Lỗi', 'Không thể mở thư viện ảnh.');
    }
  };

  const handlePickImage = () => {
    Alert.alert(
      'Chọn hình ảnh',
      'Bạn muốn chụp ảnh mới hay chọn ảnh từ thư viện?',
      [
        {
          text: 'Chụp ảnh',
          onPress: handleTakeCameraPhoto,
        },
        {
          text: 'Chọn từ thư viện',
          onPress: handleSelectFromLibrary,
        },
        {
          text: 'Hủy',
          style: 'cancel',
        },
      ]
    );
  };

  const handleCommentSubmit = async () => {
    if ((!commentText.trim() && !selectedImage) || !post) return;
    
    try {
      setSubmittingComment(true);
      
      let res;
      if (selectedImage) {
        const formData = new FormData();
        formData.append('content', commentText.trim());
        
        const uri = selectedImage.uri;
        const uriParts = uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        const fileName = uri.split('/').pop();

        formData.append('media', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: fileName || `comment-img.${fileType}`,
          type: `image/${fileType}`,
        });
        
        res = await commentPostRequest(post._id, formData, token);
      } else {
        res = await commentPostRequest(post._id, commentText.trim(), token);
      }

      if (res?.success && res?.data) {
        // Add new comment to the list
        setComments((prev) => [...prev, res.data]);
        // Update comments count on post details
        setPost((prev) => ({
          ...prev,
          commentsCount: res.commentsCount,
        }));
        // Update comments count in Redux store for feed synchrony
        dispatch(updateCommentCountInFeed({ postId: post._id, commentsCount: res.commentsCount }));
        setCommentText('');
        setSelectedImage(null);
      } else {
        Alert.alert('Lỗi', 'Không thể đăng bình luận');
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Gửi bình luận thất bại');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeletePost = () => {
    if (!post) return;
    Alert.alert('Xóa bài viết', 'Bạn có chắc chắn muốn xóa bài viết này không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePostRequest(post._id, token);
            dispatch(deletePostInFeed(post._id));
            Alert.alert('Thành công', 'Đã xóa bài viết.');
            navigation.goBack();
          } catch (err) {
            Alert.alert('Lỗi', err.message || 'Không thể xóa bài viết');
          }
        },
      },
    ]);
  };

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

  const renderCommentItem = ({ item }) => {
    const avatarColor = getAvatarColor(item.userId?.name);
    const isExpanded = expandedComments[item._id];
    const shouldTruncate = item.content && item.content.length > 150;
    
    let displayContent = item.content;
    if (shouldTruncate && !isExpanded) {
      displayContent = item.content.slice(0, 150) + '...';
    }
    
    return (
      <View style={styles.commentItem}>
        {item.userId?.picture ? (
          <Image source={{ uri: item.userId.picture }} style={styles.commentAvatar} />
        ) : (
          <View style={[styles.commentAvatarPlaceholder, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarInitials}>{getInitials(item.userId?.name)}</Text>
          </View>
        )}
        <View style={styles.commentRight}>
          <View style={styles.commentTextContainer}>
            <Text style={styles.commentAuthor}>{item.userId?.name || 'Thành viên'}</Text>
            {item.content ? (
              <Text style={styles.commentText}>
                {displayContent}{' '}
                {shouldTruncate && (
                  <Text
                    onPress={() => toggleExpandComment(item._id)}
                    style={styles.seeMoreText}
                  >
                    {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                  </Text>
                )}
              </Text>
            ) : null}
          </View>
          {item.mediaUrl ? (
            <Image
              source={{ uri: fixMediaUrl(item.mediaUrl) }}
              style={styles.commentImage}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.commentActions}>
            <Text style={styles.commentTime}>{formatTime(item.createdAt)}</Text>
            <TouchableOpacity style={styles.commentActionBtn}>
              <Text style={styles.commentActionText}>Thích</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.commentActionBtn}>
              <Text style={styles.commentActionText}>Trả lời</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
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
          <Text style={styles.headerTitle}>Chi tiết bài viết</Text>
          <View style={{ width: 36 }} />
        </ScreenHeader>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Đang tải bài viết...</Text>
        </View>
      </Screen>
    );
  }

  if (!post) return null;

  const isOwner = currentUser && post.userId && (currentUser.id === post.userId._id || currentUser._id === post.userId._id);
  const posterAvatarColor = getAvatarColor(post.userId?.name);
  const displayTags = post.tags?.length ? post.tags : post.sportType ? [post.sportType] : [];
  const reactionMeta = getReactionMeta(post.reactionType);

  const handleTagPress = (tagName) => {
    dispatch(setActiveTag(tagName));
    navigation.goBack();
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

        <TouchableOpacity
          style={styles.headerUserInfo}
          activeOpacity={0.8}
          onPress={() => {
            const authorId = post.userId?._id || post.userId?.id;
            if (authorId) navigation.navigate('UserProfile', { userId: authorId });
          }}
        >
          {post.userId?.picture ? (
            <Image source={{ uri: post.userId.picture }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatarPlaceholder, { backgroundColor: posterAvatarColor }]}>
              <Text style={styles.headerAvatarText}>{getInitials(post.userId?.name)}</Text>
            </View>
          )}
          <View style={styles.headerNameCol}>
            <Text style={styles.headerName} numberOfLines={1}>{post.userId?.name || 'Thành viên'}</Text>
            <Text style={styles.headerSubtext}>
              {post.sportType ? `⚽ ${post.sportType} • ` : ''}
              {formatTime(post.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setOptionsVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.optionsButton}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#7C8190" />
        </TouchableOpacity>
      </ScreenHeader>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => item._id}
          renderItem={renderCommentItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.postDetailsContainer}>
              {displayTags.length > 0 ? (
                <View style={styles.tagRow}>
                  {displayTags.map((tagName) => (
                    <TouchableOpacity
                      key={tagName}
                      onPress={() => handleTagPress(tagName)}
                      style={styles.tagBadge}
                    >
                      <Text style={styles.tagBadgeText}>{tagName}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {post.content ? <Text style={styles.postContent}>{post.content}</Text> : null}

              {/* Media content */}
              {post.mediaUrls && post.mediaUrls.length > 0 && (
                <View style={styles.mediaContainer}>
                  {post.mediaUrls.map((url, index) => (
                    <Image
                      key={index}
                      source={{ uri: fixMediaUrl(url) }}
                      style={styles.postMedia}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              )}

              {(post.likesCount > 0 || post.commentsCount > 0) ? (
                <View style={styles.engagementRow}>
                  <ReactionsPreview
                    likesCount={post.likesCount || 0}
                    topReactions={post.topReactions || []}
                    onPress={handleOpenLikes}
                  />
                  {post.commentsCount > 0 ? (
                    <Text style={styles.commentSummaryText}>{post.commentsCount} bình luận</Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.divider} />

              <View style={styles.actionsBar}>
                <TouchableOpacity
                  onPress={handleLikePost}
                  onLongPress={() => setReactionPickerVisible(true)}
                  delayLongPress={220}
                  style={styles.actionBtn}
                >
                  {post.isLiked ? (
                    <Text style={styles.actionEmoji}>{reactionMeta.emoji}</Text>
                  ) : (
                    <Ionicons name="heart-outline" size={20} color="#7C8190" />
                  )}
                  <Text
                    style={[
                      styles.actionText,
                      post.isLiked && { color: reactionMeta.color },
                    ]}
                  >
                    {post.isLiked ? reactionMeta.label : 'Thích'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.actionBtn}>
                  <Ionicons name="chatbubble-outline" size={20} color="#7C8190" />
                  <Text style={styles.actionText}>{post.commentsCount || 0} Bình luận</Text>
                </View>

                <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
                  <Ionicons name="share-outline" size={20} color="#7C8190" />
                  <Text style={styles.actionText}>Chia sẻ</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.commentsHeaderBar}>
                <Text style={styles.commentsHeaderText}>
                  {comments.length} BÌNH LUẬN
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubbles-outline" size={36} color="#D1D5DB" />
              <Text style={styles.emptyCommentsText}>Chưa có bình luận nào. Hãy bắt đầu cuộc trò chuyện!</Text>
            </View>
          }
        />

        {/* Selected image preview */}
        {selectedImage && (
          <View style={styles.imagePreviewContainer}>
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
              <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeImageBtn}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Comment input row at bottom */}
        <View style={styles.inputContainer}>
          {currentUser?.picture ? (
            <Image source={{ uri: currentUser.picture }} style={styles.inputAvatar} />
          ) : (
            <View style={[styles.inputAvatarPlaceholder, { backgroundColor: getAvatarColor(currentUser?.name) }]}>
              <Text style={styles.inputAvatarText}>{getInitials(currentUser?.name)}</Text>
            </View>
          )}
          
          <View style={styles.commentInputWrapper}>
            <TextInput
              placeholder="Viết bình luận..."
              placeholderTextColor="#9CA3AF"
              style={styles.commentTextInput}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity onPress={handlePickImage} style={styles.cameraBtnInside}>
              <Ionicons name="camera-outline" size={22} color="#7C8190" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            onPress={handleCommentSubmit}
            disabled={(!commentText.trim() && !selectedImage) || submittingComment}
            style={[
              styles.sendBtn,
              ((!commentText.trim() && !selectedImage) || submittingComment) && styles.sendBtnDisabled,
            ]}
          >
            {submittingComment ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Bottom Sheet Modal for options */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={optionsVisible}
        onRequestClose={() => setOptionsVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setOptionsVisible(false)}
          style={styles.modalOverlay}
        >
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>TÙY CHỌN BÀI VIẾT</Text>

            <TouchableOpacity
              onPress={() => {
                setOptionsVisible(false);
                handleToggleSavePost();
              }}
              style={styles.bottomSheetOption}
            >
              <Ionicons
                name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color="#FF6B35"
              />
              <Text style={[styles.bottomSheetOptionText, { color: '#FF6B35' }]}>
                {post.isSaved ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
              </Text>
            </TouchableOpacity>

            {isOwner ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setOptionsVisible(false);
                    navigation.navigate('CreatePost', { editPost: post });
                  }}
                  style={styles.bottomSheetOption}
                >
                  <Ionicons name="pencil-outline" size={20} color="#374151" />
                  <Text style={styles.bottomSheetOptionText}>Sửa bài viết</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setOptionsVisible(false);
                    handleDeletePost();
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
                  setOptionsVisible(false);
                  Alert.alert('Thành công', 'Cảm ơn bạn đã gửi báo cáo. Chúng tôi sẽ xem xét bài viết này sớm nhất có thể!');
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
        visible={reactionPickerVisible}
        onClose={() => setReactionPickerVisible(false)}
        onSelect={handleSelectReaction}
      />

      <LikesModal
        visible={likesVisible}
        loading={likesLoading}
        summary={likesSummary}
        activeFilter={activeReactionFilter}
        onChangeFilter={setActiveReactionFilter}
        onClose={() => setLikesVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    marginRight: 8,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E5E7EB',
  },
  headerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  headerNameCol: {
    marginLeft: 10,
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  optionsButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  postDetailsContainer: {
    padding: 16,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagBadge: {
    backgroundColor: '#FFF0EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagBadgeText: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '700',
  },
  postContent: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
  },
  mediaContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  postMedia: {
    width: '100%',
    height: 220,
    backgroundColor: '#E5E7EB',
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
    marginTop: 12,
  },
  commentSummaryText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
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
  actionEmoji: {
    fontSize: 18,
    width: 20,
    textAlign: 'center',
  },
  commentsHeaderBar: {
    marginTop: 16,
    paddingTop: 8,
  },
  commentsHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7C8190',
    letterSpacing: 0.5,
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentRight: {
    flex: 1,
    marginLeft: 10,
  },
  commentTextContainer: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 4,
    gap: 12,
  },
  commentTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  commentActionBtn: {
    paddingVertical: 2,
  },
  commentActionText: {
    fontSize: 12,
    color: '#7C8190',
    fontWeight: '600',
  },
  emptyComments: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyCommentsText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  inputAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  inputAvatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    marginHorizontal: 10,
    maxHeight: 80,
  },
  commentTextInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
  },
  cameraBtnInside: {
    padding: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#93C5FD',
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
  commentImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginTop: 6,
    backgroundColor: '#E5E7EB',
  },
  imagePreviewContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexDirection: 'row',
  },
  imagePreviewWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  seeMoreText: {
    color: '#0066cc',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
