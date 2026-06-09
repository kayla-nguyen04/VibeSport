const Post = require('../models/Post');
const PostLike = require('../models/PostLike');
const Comment = require('../models/Comment');
const { API_BASE_URL } = require('../utils/config');
const {
  parseTagsInput,
  enrichPostTags,
  resolveCatalogTags,
  updateTagUsageCounts,
} = require('../utils/tagHelpers');

// Helper to construct media absolute URLs
function getAbsoluteUrl(req, filename) {
  return `${API_BASE_URL}/uploads/posts/${filename}`;
}

// ─── POST CONTROLLER HANDLERS ─────────────────────────────────

// 1. Create a new post
async function buildPostTags({ tagsInput, sportType, content }) {
  const requestedTags = parseTagsInput(tagsInput);
  const mergedTags = [...new Set([...(requestedTags || []), sportType].filter(Boolean))];
  const resolvedTags = await resolveCatalogTags(mergedTags);

  if (resolvedTags.length === 0 && sportType) {
    const fallback = await resolveCatalogTags([sportType]);
    return fallback.length > 0 ? fallback : [sportType];
  }

  return resolvedTags;
}

exports.createPost = async (req, res) => {
  try {
    const { content, location, sportType, tags } = req.body;
    const finalSportType = sportType || 'Bóng đá';

    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      mediaUrls = req.files.map((file) => getAbsoluteUrl(req, file.filename));
    }

    const resolvedTags = await buildPostTags({
      tagsInput: tags,
      sportType: finalSportType,
      content,
    });

    const post = new Post({
      userId: req.userId,
      content: content || '',
      mediaUrls,
      location: location || '',
      sportType: resolvedTags[0] || finalSportType,
      tags: resolvedTags,
    });

    await post.save();
    await updateTagUsageCounts([], resolvedTags);

    const populatedPost = await Post.findById(post._id).populate('userId', 'name picture favoriteSport');

    res.status(201).json({
      success: true,
      message: 'Đăng bài thành công!',
      data: enrichPostTags(populatedPost),
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo bài viết' });
  }
};

// 2. Fetch list of posts (paginated)
exports.getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const tag = String(req.query.tag || req.query.sportType || '').trim();
    const userId = String(req.query.userId || '').trim();

    const filter = {};
    if (tag) {
      filter.$or = [{ tags: tag }, { sportType: tag }];
    }
    if (userId) {
      filter.userId = userId;
    }

    const posts = await Post.find(filter)
      .populate('userId', 'name picture favoriteSport')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const mappedPosts = await Promise.all(
      posts.map(async (post) => {
        let isLiked = false;
        if (req.userId) {
          const like = await PostLike.findOne({ postId: post._id, userId: req.userId });
          isLiked = !!like;
        }
        return {
          ...enrichPostTags(post),
          isLiked,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: mappedPosts,
      page,
      limit,
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách bài viết' });
  }
};

// 3. Fetch single post details with comments
exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate('userId', 'name picture favoriteSport');
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    let isLiked = false;
    if (req.userId) {
      const like = await PostLike.findOne({ postId: post._id, userId: req.userId });
      isLiked = !!like;
    }

    const comments = await Comment.find({ postId: id })
      .populate('userId', 'name picture favoriteSport')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: {
        ...enrichPostTags(post),
        isLiked,
        comments,
      },
    });
  } catch (error) {
    console.error('Get post detail error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết bài viết' });
  }
};

// 4. Toggle like on a post (Optimistic friendly)
exports.likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    const existingLike = await PostLike.findOne({ postId: id, userId });
    let liked = false;

    if (existingLike) {
      await PostLike.deleteOne({ _id: existingLike._id });
      post.likesCount = Math.max(0, post.likesCount - 1);
      liked = false;
    } else {
      const newLike = new PostLike({ postId: id, userId });
      await newLike.save();
      post.likesCount += 1;
      liked = true;
    }

    await post.save();

    res.status(200).json({
      success: true,
      liked,
      likesCount: post.likesCount,
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi thích/bỏ thích bài viết' });
  }
};

// 5. Add a comment to a post
exports.commentPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    let mediaUrl = null;
    if (req.file) {
      mediaUrl = getAbsoluteUrl(req, req.file.filename);
    }

    if ((!content || !content.trim()) && !mediaUrl) {
      return res.status(400).json({ success: false, message: 'Nội dung bình luận hoặc ảnh không được để trống' });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    const comment = new Comment({
      postId: id,
      userId: req.userId,
      content: content ? content.trim() : '',
      mediaUrl,
    });

    await comment.save();

    post.commentsCount += 1;
    await post.save();

    const populatedComment = await Comment.findById(comment._id).populate('userId', 'name picture favoriteSport');

    res.status(201).json({
      success: true,
      message: 'Đã thêm bình luận!',
      data: populatedComment,
      commentsCount: post.commentsCount,
    });
  } catch (error) {
    console.error('Comment post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi bình luận' });
  }
};

// 6. Delete a post
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    // Only post owner can delete
    if (post.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bài viết này' });
    }

    // Delete post and all associated comments and likes
    await Post.deleteOne({ _id: id });
    await Comment.deleteMany({ postId: id });
    await PostLike.deleteMany({ postId: id });

    res.status(200).json({
      success: true,
      message: 'Xóa bài viết thành công!',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa bài viết' });
  }
};

// 7. Update a post (owner only)
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    // Only post owner can update
    if (post.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa bài viết này' });
    }

    const { content, location, sportType, tags } = req.body;
    const previousTags = [...(post.tags || [])];

    if (content !== undefined) post.content = content;
    if (location !== undefined) post.location = location;

    if (tags !== undefined || sportType !== undefined) {
      const resolvedTags = await buildPostTags({
        tagsInput: tags !== undefined ? tags : post.tags,
        sportType: sportType !== undefined ? sportType : post.sportType,
        content: content !== undefined ? content : post.content,
      });

      post.tags = resolvedTags;
      post.sportType = resolvedTags[0] || sportType || post.sportType;
      await updateTagUsageCounts(previousTags, resolvedTags);
    } else if (sportType !== undefined) {
      post.sportType = sportType;
    }

    if (req.files && req.files.length > 0) {
      const newMediaUrls = req.files.map((file) => getAbsoluteUrl(req, file.filename));
      post.mediaUrls = [...post.mediaUrls, ...newMediaUrls];
    }

    await post.save();

    const populatedPost = await Post.findById(post._id).populate('userId', 'name picture favoriteSport');

    res.status(200).json({
      success: true,
      message: 'Cập nhật bài viết thành công!',
      data: enrichPostTags(populatedPost),
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật bài viết' });
  }
};
