const Post = require('../models/Post');
const PostLike = require('../models/PostLike');
const SavedPost = require('../models/SavedPost');
const Comment = require('../models/Comment');
const CommentLike = require('../models/CommentLike');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { API_BASE_URL } = require('../utils/config');
const {
  parseTagsInput,
  enrichPostTags,
  resolveCatalogTags,
  updateTagUsageCounts,
} = require('../utils/tagHelpers');

async function createAndSendNotification({ userId, fromUserId, type, message, postId, commentId, postThumbnail }) {
  try {
    const notification = new Notification({
      userId,
      fromUserId,
      type,
      message,
      postId,
      commentId,
      postThumbnail,
    });
    await notification.save();

    const populated = await Notification.findById(notification._id)
      .populate('fromUserId', 'name picture')
      .populate('postId', 'content mediaUrls');

    if (global.io) {
      global.io.to(userId.toString()).emit('new_notification', populated);
      
      const unreadCount = await Notification.countDocuments({ userId, read: false });
      global.io.to(userId.toString()).emit('unread_count', { unreadCount });
      console.log(`[SOCKET] Notification sent to user ${userId}, unread: ${unreadCount}`);
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

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
      data: {
        ...enrichPostTags(populatedPost),
        isLiked: false,
        reactionType: null,
        topReactions: [],
        isSaved: false,
      },
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo bài viết' });
  }
};

// 2. Fetch list of posts (paginated, searchable)
exports.getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const tag = String(req.query.tag || req.query.sportType || '').trim();
    const userId = String(req.query.userId || '').trim();
    const keyword = String(req.query.keyword || '').trim();

    // ─── Keyword search: dùng aggregation để ưu tiên theo thứ tự ───
    if (keyword) {
      return await searchPostsWithPriority({ req, res, keyword, tag, userId, page, limit, skip });
    }

    const filter = {};
    if (tag) {
      if (tag === 'Tìm đội') {
        filter.$or = [{ tags: tag }, { sportType: tag }];
      } else {
        filter.$and = [
          { $or: [{ tags: tag }, { sportType: tag }] },
          { tags: { $ne: 'Tìm đội' } }
        ];
      }
    } else {
      filter.tags = { $ne: 'Tìm đội' };
    }
    if (userId) filter.userId = userId;

    const posts = await Post.find(filter)
      .populate('userId', 'name picture favoriteSport')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const mappedPosts = await mapPostInteractions(posts, req.userId);

    res.status(200).json({ success: true, data: mappedPosts, page, limit });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách bài viết' });
  }
};

// ─── Hàm search với ưu tiên: tên người → tag → nội dung ──────────
async function searchPostsWithPriority({ req, res, keyword, tag, userId, page, limit, skip }) {
  try {
    const keywordRegex = new RegExp(keyword, 'i');

    // Tìm các userId có tên khớp keyword
    const matchingUsers = await User.find({ name: keywordRegex }).select('_id').lean();
    const matchingUserIds = matchingUsers.map(u => u._id);

    // Điều kiện khớp: tên người HOẶC tag HOẶC sportType HOẶC nội dung
    const orConditions = [];
    if (matchingUserIds.length > 0) {
      orConditions.push({ userId: { $in: matchingUserIds } });
    }
    orConditions.push(
      { tags: { $regex: keyword, $options: 'i' } },
      { sportType: { $regex: keyword, $options: 'i' } },
      { content: { $regex: keyword, $options: 'i' } },
    );

    const matchFilter = { $or: orConditions };

    // Thêm filter tag (bộ lọc môn) nếu có
    if (tag) {
      if (tag === 'Tìm đội') {
        matchFilter.$and = [
          { $or: [{ tags: tag }, { sportType: tag }] },
        ];
      } else {
        matchFilter.$and = [
          { $or: [{ tags: tag }, { sportType: tag }] },
          { tags: { $ne: 'Tìm đội' } },
        ];
      }
    } else {
      matchFilter.tags = { $ne: 'Tìm đội' };
    }
    if (userId) {
      matchFilter.userId = userId;
    }

    // Score branches: tên người (30) > tag (20) > sportType (15) > nội dung (10)
    const scoreBranches = [];
    if (matchingUserIds.length > 0) {
      scoreBranches.push({
        case: { $in: ['$userId', matchingUserIds] },
        then: 30,
      });
    }
    scoreBranches.push(
      {
        // Tag array chứa ít nhất 1 phần tử khớp keyword
        case: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $ifNull: ['$tags', []] },
                  as: 't',
                  cond: { $regexMatch: { input: '$$t', regex: keyword, options: 'i' } },
                },
              },
            },
            0,
          ],
        },
        then: 20,
      },
      {
        case: { $regexMatch: { input: { $ifNull: ['$sportType', ''] }, regex: keyword, options: 'i' } },
        then: 15,
      },
      {
        case: { $regexMatch: { input: { $ifNull: ['$content', ''] }, regex: keyword, options: 'i' } },
        then: 10,
      },
    );

    const pipeline = [
      { $match: matchFilter },
      // Gán điểm ưu tiên
      {
        $addFields: {
          _searchScore: {
            $switch: { branches: scoreBranches, default: 0 },
          },
        },
      },
      // Sắp xếp: điểm cao nhất → mới nhất
      { $sort: { _searchScore: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      // Populate userId
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, picture: 1, favoriteSport: 1 } }],
          as: '_userArr',
        },
      },
      {
        $addFields: { userId: { $arrayElemAt: ['$_userArr', 0] } },
      },
      { $project: { _userArr: 0, _searchScore: 0 } },
    ];

    const rawPosts = await Post.aggregate(pipeline);
    const mappedPosts = await mapPostInteractions(rawPosts, req.userId);

    res.status(200).json({ success: true, data: mappedPosts, page, limit });
  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tìm kiếm bài viết' });
  }
}

// ─── Helper: map interaction (liked, saved, topReactions) ────────
async function mapPostInteractions(posts, currentUserId) {
  return Promise.all(
    posts.map(async (post) => {
      const postId = post._id;
      let isLiked = false;
      let reactionType = null;
      let isSaved = false;

      if (currentUserId) {
        const like = await PostLike.findOne({ postId, userId: currentUserId });
        if (like) {
          isLiked = true;
          reactionType = like.reactionType;
        }
        isSaved = Boolean(await SavedPost.exists({ postId, userId: currentUserId }));
      }

      const reactionsCount = await PostLike.aggregate([
        { $match: { postId } },
        { $group: { _id: '$reactionType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 2 },
      ]);
      const topReactions = reactionsCount.map(r => r._id);

      return {
        ...enrichPostTags(post),
        isLiked,
        reactionType,
        topReactions,
        isSaved,
      };
    })
  );
}

// 3. Fetch single post details with comments
exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate('userId', 'name picture favoriteSport');
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    let isLiked = false;
    let reactionType = null;
    let isSaved = false;
    if (req.userId) {
      const like = await PostLike.findOne({ postId: post._id, userId: req.userId });
      if (like) {
        isLiked = true;
        reactionType = like.reactionType;
      }
      isSaved = Boolean(await SavedPost.exists({ postId: post._id, userId: req.userId }));
    }

    // Get top 2 reactions
    const reactionsCount = await PostLike.aggregate([
      { $match: { postId: post._id } },
      { $group: { _id: '$reactionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 2 }
    ]);
    const topReactions = reactionsCount.map(r => r._id);

    // Fetch all comments for this post
    const allComments = await Comment.find({ postId: id })
      .populate('userId', 'name picture favoriteSport')
      .sort({ createdAt: 1 });

    // Fetch the comments liked by the logged-in user
    let userLikedCommentIds = new Set();
    if (req.userId) {
      const likes = await CommentLike.find({ userId: req.userId });
      userLikedCommentIds = new Set(likes.map((l) => l.commentId.toString()));
    }

    // Map comments to include isLiked flag
    const commentMap = {};
    const topLevelComments = [];

    allComments.forEach((comment) => {
      const cObj = comment.toObject();
      cObj.isLiked = userLikedCommentIds.has(cObj._id.toString());
      cObj.replies = [];
      commentMap[cObj._id.toString()] = cObj;

      if (!cObj.parentId) {
        topLevelComments.push(cObj);
      }
    });

    // Populate replies
    allComments.forEach((comment) => {
      if (comment.parentId) {
        const parent = commentMap[comment.parentId.toString()];
        if (parent) {
          const cObj = commentMap[comment._id.toString()];
          cObj.replyToName = parent.userId?.name || 'Thành viên';
          parent.replies.push(cObj);
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        ...enrichPostTags(post),
        isLiked,
        reactionType,
        topReactions,
        isSaved,
        comments: topLevelComments,
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
    const { reactionType = 'like' } = req.body;
    const userId = req.userId;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    const existingLike = await PostLike.findOne({ postId: id, userId });
    let liked = false;
    let currentReaction = reactionType;

    if (existingLike) {
      if (existingLike.reactionType === reactionType) {
        // Trùng reaction type thì unlike
        await PostLike.deleteOne({ _id: existingLike._id });
        post.likesCount = Math.max(0, post.likesCount - 1);
        liked = false;
        currentReaction = null;
      } else {
        // Khác reaction type thì cập nhật
        existingLike.reactionType = reactionType;
        await existingLike.save();
        liked = true;
      }
    } else {
      // Chưa like thì tạo mới
      const newLike = new PostLike({ postId: id, userId, reactionType });
      await newLike.save();
      post.likesCount += 1;
      liked = true;
    }

    await post.save();

    // Gửi thông báo đến chủ bài viết nếu có cảm xúc mới và không tự thả tim bài của mình
    if (liked && post.userId.toString() !== userId.toString()) {
      const sender = await User.findById(userId);
      const senderName = sender ? sender.name : 'Một thành viên';
      
      const sportEmojis = {
        'Bóng đá': '⚽',
        'Cầu lông': '🏸',
        'Pickleball': '🏓'
      };
      
      const activeSport = post.sportType || 'Bóng đá';
      const emoji = sportEmojis[activeSport] || '🔔';
      const message = `${emoji} ${senderName} đã thích bài viết của bạn`;
      const postThumbnail = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : null;

      await createAndSendNotification({
        userId: post.userId,
        fromUserId: userId,
        type: 'like',
        message,
        postId: post._id,
        postThumbnail,
      });
    }

    // Get top 2 reactions
    const reactionsCount = await PostLike.aggregate([
      { $match: { postId: post._id } },
      { $group: { _id: '$reactionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 2 }
    ]);
    const topReactions = reactionsCount.map(r => r._id);

    res.status(200).json({
      success: true,
      isLiked: liked,
      reactionType: currentReaction,
      likesCount: post.likesCount,
      topReactions,
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi thích/bỏ thích bài viết' });
  }
};

// 4b. Unlike a post directly
exports.unlikePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    const existingLike = await PostLike.findOne({ postId: id, userId });
    if (existingLike) {
      await PostLike.deleteOne({ _id: existingLike._id });
      post.likesCount = Math.max(0, post.likesCount - 1);
      await post.save();
    }

    // Get top 2 reactions
    const reactionsCount = await PostLike.aggregate([
      { $match: { postId: post._id } },
      { $group: { _id: '$reactionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 2 }
    ]);
    const topReactions = reactionsCount.map(r => r._id);

    res.status(200).json({
      success: true,
      isLiked: false,
      reactionType: null,
      likesCount: post.likesCount,
      topReactions,
    });
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi bỏ thích bài viết' });
  }
};

// 4c. Get list of users who liked the post
exports.getPostLikes = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    const likes = await PostLike.find({ postId: id })
      .populate('userId', 'name picture')
      .sort({ createdAt: -1 });

    const totalLikes = likes.length;

    const reactions = {
      like: 0,
      love: 0,
      haha: 0
    };

    likes.forEach(like => {
      if (reactions[like.reactionType] !== undefined) {
        reactions[like.reactionType]++;
      } else {
        reactions[like.reactionType] = 1;
      }
    });

    const users = likes.map(like => {
      if (!like.userId) return null;
      return {
        _id: like.userId._id,
        name: like.userId.name,
        avatar: like.userId.picture,
        reactionType: like.reactionType
      };
    }).filter(Boolean);

    res.status(200).json({
      success: true,
      totalLikes,
      reactions,
      users
    });
  } catch (error) {
    console.error('Get post likes error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách người thích' });
  }
};

// 5. Add a comment to a post
exports.commentPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parentId } = req.body;

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
      parentId: parentId || null,
    });

    await comment.save();

    post.commentsCount += 1;
    await post.save();

    const populatedComment = await Comment.findById(comment._id).populate('userId', 'name picture favoriteSport');
    const commentObj = populatedComment.toObject();

    const commenterName = populatedComment.userId?.name || 'Một thành viên';
    const postThumbnail = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : null;

    if (parentId) {
      const parentComment = await Comment.findById(parentId).populate('userId', 'name');
      commentObj.replyToName = parentComment?.userId?.name || 'Thành viên';

      // Gửi thông báo reply đến chủ comment cha (nếu không tự trả lời chính mình)
      if (parentComment && parentComment.userId && parentComment.userId._id.toString() !== req.userId.toString()) {
        await createAndSendNotification({
          userId: parentComment.userId._id,
          fromUserId: req.userId,
          type: 'reply',
          message: `🔥 ${commenterName} đã trả lời bình luận của bạn`,
          postId: post._id,
          commentId: comment._id,
          postThumbnail,
        });
      }
    } else {
      // Gửi thông báo comment đến chủ bài viết (nếu không tự bình luận bài của mình)
      if (post.userId.toString() !== req.userId.toString()) {
        await createAndSendNotification({
          userId: post.userId,
          fromUserId: req.userId,
          type: 'comment',
          message: `💬 ${commenterName} đã bình luận bài viết của bạn`,
          postId: post._id,
          commentId: comment._id,
          postThumbnail,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Đã thêm bình luận!',
      data: commentObj,
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
    await SavedPost.deleteMany({ postId: id });

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
      let tagsInput = tags !== undefined ? tags : post.tags;
      if (previousTags.includes('Tìm đội')) {
        const parsed = parseTagsInput(tagsInput);
        if (!parsed.includes('Tìm đội')) {
          parsed.push('Tìm đội');
        }
        tagsInput = JSON.stringify(parsed);
      }

      const resolvedTags = await buildPostTags({
        tagsInput,
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

// 8. Like / Unlike a comment
exports.likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận' });
    }

    const existingLike = await CommentLike.findOne({ commentId, userId });
    let liked = false;

    if (existingLike) {
      await CommentLike.deleteOne({ _id: existingLike._id });
      comment.likesCount = Math.max(0, comment.likesCount - 1);
      liked = false;
    } else {
      const newLike = new CommentLike({ commentId, userId });
      await newLike.save();
      comment.likesCount += 1;
      liked = true;
    }

    await comment.save();

    res.status(200).json({
      success: true,
      liked,
      likesCount: comment.likesCount,
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi thích/bỏ thích bình luận' });
  }
};
