const Post = require('../models/Post');
const FC = require('../models/FC');
const PostLike = require('../models/PostLike');
const SavedPost = require('../models/SavedPost');
const Comment = require('../models/Comment');
const CommentLike = require('../models/CommentLike');
const User = require('../models/User');
const Follow = require('../models/Follow');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const { API_BASE_URL } = require('../utils/config');
const { incrementReportCount } = require('../utils/reportHelpers');
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
      
      const unreadCount = await Notification.countDocuments({
        userId,
        read: false,
        type: { $ne: 'message' },
      });
      global.io.to(userId.toString()).emit('unread_count', { unreadCount });
      console.log(`[SOCKET] Notification sent to user ${userId}, unread: ${unreadCount}`);
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Helper to construct media absolute URLs
function getAbsoluteUrl(req, file) {
  if (!file) return '';
  return file.path || `${API_BASE_URL}/uploads/posts/${file.filename}`;
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
    let { content, location, sportType, tags, fcId } = req.body;
    if (sportType === 'Không chọn' || sportType === 'Không') {
      sportType = '';
    }

    // Nếu bài viết thuộc một FC, tự động kế thừa sportType của FC
    if (fcId && !sportType) {
      const fcDoc = await FC.findById(fcId).select('sportType').lean();
      if (fcDoc && fcDoc.sportType) {
        sportType = fcDoc.sportType;
      }
    }

    const finalSportType = sportType;

    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      mediaUrls = req.files.map((file) => getAbsoluteUrl(req, file));
    }

    const resolvedTags = await buildPostTags({
      tagsInput: tags,
      sportType: finalSportType,
      content,
    });

    const post = new Post({
      userId: req.userId,
      fcId: fcId || null,
      content: content || '',
      mediaUrls,
      location: location || '',
      sportType: resolvedTags[0] || finalSportType || '',
      tags: resolvedTags,
    });

    await post.save();
    await updateTagUsageCounts([], resolvedTags);

    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'name picture favoriteSport')
      .populate('fcId', 'name avatar description isPrivate');

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

// 2. Fetch list of posts (paginated, searchable, tab filtering)
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
    // Hide removed posts from public feed
    filter.status = { $ne: 'removed_by_admin' };

    // 🟢 THÊM CODE XỬ LÝ DÀNH CHO TAB "ĐANG FOLLOW" VÀ "ĐÃ FOLLOW"
    if (tag === 'following' || tag === 'followed') {
      const currentUserId = req.userId;
      if (!currentUserId) {
        return res.status(200).json({ success: true, data: [], page, limit });
      }

      let targetUserIds = [];
      if (tag === 'following') {
        // Lấy danh sách những người mà user hiện tại ĐANG FOLLOW
        targetUserIds = await Follow.find({ followerId: currentUserId }).distinct('followingId');
      } else if (tag === 'followed') {
        // Lấy danh sách những người ĐÃ FOLLOW user hiện tại (Người theo dõi mình)
        targetUserIds = await Follow.find({ followingId: currentUserId }).distinct('followerId');
      }

      filter.userId = { $in: targetUserIds };
      filter.tags = { $ne: 'Tìm đội' };
    } else if (tag) {
      // Logic lọc theo Tag môn thể thao nguyên bản
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

    // Ưu tiên bài viết từ người đang follow (Bảo toàn nguyên bản)
    let followingIds = [];
    let sortStage = { createdAt: -1 };
    if (req.userId && !userId) {
      followingIds = await Follow.find({ followerId: req.userId }).distinct('followingId');
      if (followingIds.length > 0) {
        sortStage = { isFollowing: -1, createdAt: -1 };
      }
    }

    // Lấy danh sách FC mà user đang là thành viên để lọc bài viết của FC riêng tư (Bảo toàn nguyên bản)
    let memberFcIds = [];
    if (req.userId) {
      const memberFcs = await FC.find({ members: req.userId, isPrivate: true }).select('_id').lean();
      memberFcIds = memberFcs.map((f) => f._id);
    }
    // Lấy danh sách tất cả FC riêng tư
    const allPrivateFcs = await FC.find({ isPrivate: true }).select('_id').lean();
    const allPrivateFcIds = allPrivateFcs.map((f) => f._id);
    // Chỉ bao gồm bài viết không thuộc FC riêng tư, hoặc thuộc FC riêng tư mà user là thành viên
    const excludedPrivateFcIds = allPrivateFcIds.filter(
      (fcId) => !memberFcIds.some((mId) => String(mId) === String(fcId))
    );
    if (excludedPrivateFcIds.length > 0) {
      const privateFcFilter = {
        $or: [
          { fcId: null },
          { fcId: { $exists: false } },
          { fcId: { $nin: excludedPrivateFcIds } },
        ],
      };
      filter.$and = filter.$and
        ? [...filter.$and, privateFcFilter]
        : [privateFcFilter];
    }

    const aggregatePipeline = [
      { $match: filter },
      {
        $addFields: {
          isFollowing: {
            $cond: {
              if: req.userId && followingIds && followingIds.length > 0,
              then: { $in: ['$userId', followingIds] },
              else: false,
            },
          },
        },
      },
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limit },
    ];

    const posts = await Post.aggregate(aggregatePipeline);

    // Populate user info (Bảo toàn nguyên bản)
    const populatedPosts = await Promise.all(
      posts.map(async (post) => {
        const user = await User.findById(post.userId).select('name picture favoriteSport').lean();
        let fc = null;
        if (post.fcId) {
          fc = await FC.findById(post.fcId).select('name avatar description isPrivate').lean();
        }
        return { ...post, userId: user, fcId: fc };
      })
    );

    const mappedPosts = await mapPostInteractions(populatedPosts, req.userId, followingIds);

    res.status(200).json({ success: true, data: mappedPosts, page, limit });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách bài viết' });
  }
};

// ─── Hàm search với ưu tiên: tên người → tag → nội dung (Bảo toàn nguyên bản) ──────────
async function searchPostsWithPriority({ req, res, keyword, tag, userId, page, limit, skip }) {
  try {
    const keywordRegex = new RegExp(keyword, 'i');

    const matchingUsers = await User.find({ name: keywordRegex }).select('_id').lean();
    const matchingUserIds = matchingUsers.map(u => u._id);

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
    matchFilter.status = { $ne: 'removed_by_admin' };

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

    const scoreBranches = [];
    let followingIds = [];
    if (req.userId) {
      followingIds = await Follow.find({ followerId: req.userId }).distinct('followingId');
      if (followingIds.length > 0 && matchingUserIds.length > 0) {
        scoreBranches.push({
          case: { $in: ['$userId', matchingUserIds] },
          then: 30,
        });
      }
    } else {
      if (matchingUserIds.length > 0) {
        scoreBranches.push({
          case: { $in: ['$userId', matchingUserIds] },
          then: 30,
        });
      }
    }
    scoreBranches.push(
      {
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
      {
        $addFields: {
          _searchScore: {
            $switch: { branches: scoreBranches, default: 0 },
          },
        },
      },
      { $sort: { _searchScore: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
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
      {
        $lookup: {
          from: 'fcs',
          localField: 'fcId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, avatar: 1, description: 1, isPrivate: 1 } }],
          as: '_fcArr',
        },
      },
      {
        $addFields: { fcId: { $arrayElemAt: ['$_fcArr', 0] } },
      },
      { $project: { _userArr: 0, _fcArr: 0, _searchScore: 0 } },
    ];

    const rawPosts = await Post.aggregate(pipeline);
    const mappedPosts = await mapPostInteractions(rawPosts, req.userId, []);

    res.status(200).json({ success: true, data: mappedPosts, page, limit });
  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tìm kiếm bài viết' });
  }
}

// ─── Helper: map interaction (liked, saved, topReactions) (Bảo toàn nguyên bản) ────────
async function mapPostInteractions(posts, currentUserId, followingIds = []) {
  return Promise.all(
    posts.map(async (post) => {
      const postId = post._id;
      let isLiked = false;
      let reactionType = null;
      let isSaved = false;
      let isFollowing = Boolean(post.isFollowing);

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
        isFollowing,
      };
    })
  );
}

// 3. Fetch single post details with comments (Bảo toàn nguyên bản)
exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id)
      .populate('userId', 'name picture favoriteSport')
      .populate('fcId', 'name avatar description isPrivate');
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    let isLiked = false;
    let reactionType = null;
    let isSaved = false;
    let isFollowing = false;
    if (req.userId) {
      const like = await PostLike.findOne({ postId: post._id, userId: req.userId });
      if (like) {
        isLiked = true;
        reactionType = like.reactionType;
      }
      isSaved = Boolean(await SavedPost.exists({ postId: post._id, userId: req.userId }));
      isFollowing = Boolean(await Follow.exists({ followerId: req.userId, followingId: post.userId }));
    }

    const reactionsCount = await PostLike.aggregate([
      { $match: { postId: post._id } },
      { $group: { _id: '$reactionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 2 }
    ]);
    const topReactions = reactionsCount.map(r => r._id);

    const allComments = await Comment.find({ postId: id })
      .populate('userId', 'name picture favoriteSport')
      .sort({ createdAt: 1 });

    let userLikedCommentIds = new Set();
    if (req.userId) {
      const likes = await CommentLike.find({ userId: req.userId });
      userLikedCommentIds = new Set(likes.map((l) => l.commentId.toString()));
    }

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

    const isRemoved = post.status === 'removed_by_admin';

    res.status(200).json({
      success: true,
      data: {
        ...enrichPostTags(post),
        isLiked,
        reactionType,
        topReactions,
        isSaved,
        isFollowing,
        isRemoved,
        removalReason: isRemoved ? post.removalReason : undefined,
        removalCategory: isRemoved ? post.removalCategory : undefined,
        comments: topLevelComments,
      },
    });
  } catch (error) {
    console.error('Get post detail error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết bài viết' });
  }
};

// 4. Toggle like on a post (Bảo toàn nguyên bản)
exports.likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reactionType = 'vibe' } = req.body;
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
        await PostLike.deleteOne({ _id: existingLike._id });
        post.likesCount = Math.max(0, post.likesCount - 1);
        liked = false;
        currentReaction = null;
      } else {
        existingLike.reactionType = reactionType;
        await existingLike.save();
        liked = true;
      }
    } else {
      const newLike = new PostLike({ postId: id, userId, reactionType });
      await newLike.save();
      post.likesCount += 1;
      liked = true;
    }

    await post.save();

    if (liked && post.userId.toString() !== userId.toString()) {
      const sender = await User.findById(userId);
      const senderName = sender ? sender.name : 'Một thành viên';
      
      const message = `${senderName} đã Vibe bài viết của bạn`;
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

    const reactionsCount = await PostLike.aggregate([
      { $match: { postId: post._id } },
      { $group: { _id: '$reactionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 2 }
    ]);
    const topReactions = reactionsCount.map(r => r._id);

    if (global.io) {
      global.io.emit('post_reaction_updated', {
        postId: post._id.toString(),
        likesCount: post.likesCount,
        topReactions,
      });
    }

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

// 4b. Unlike a post directly (Bảo toàn nguyên bản)
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

    const reactionsCount = await PostLike.aggregate([
      { $match: { postId: post._id } },
      { $group: { _id: '$reactionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 2 }
    ]);
    const topReactions = reactionsCount.map(r => r._id);

    if (global.io) {
      global.io.emit('post_reaction_updated', {
        postId: post._id.toString(),
        likesCount: post.likesCount,
        topReactions,
      });
    }

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

// 4c. Get list of users who liked the post (Bảo toàn nguyên bản)
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

// 5. Add a comment to a post (Bảo toàn nguyên bản)
exports.commentPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parentId } = req.body;

    let mediaUrl = null;
    if (req.file) {
      mediaUrl = getAbsoluteUrl(req, req.file);
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

    if (global.io) {
      global.io.emit('post_comment_updated', {
        postId: post._id.toString(),
        commentsCount: post.commentsCount,
      });
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

// 6. Delete a post (Bảo toàn nguyên bản)
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    if (post.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bài viết này' });
    }

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

// 7. Update a post (owner only) (Bảo toàn nguyên bản)
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    if (post.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa bài viết này' });
    }

    let { content, location, sportType, tags } = req.body;
    if (sportType === 'Không chọn' || sportType === 'Không') {
      sportType = '';
    }
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
      post.sportType = resolvedTags[0] || (sportType !== undefined ? sportType : post.sportType) || '';
      await updateTagUsageCounts(previousTags, resolvedTags);
    } else if (sportType !== undefined) {
      post.sportType = sportType || '';
    }

    const { keepMediaUrls } = req.body;
    let keptUrls = post.mediaUrls;
    if (keepMediaUrls !== undefined) {
      const keepList = Array.isArray(keepMediaUrls)
        ? keepMediaUrls
        : JSON.parse(keepMediaUrls || '[]');
      keptUrls = keepList.filter((url) => typeof url === 'string' && url.trim() !== '');
    }
    const newMediaUrls = req.files && req.files.length > 0
      ? req.files.map((file) => getAbsoluteUrl(req, file))
      : [];
    post.mediaUrls = [...keptUrls, ...newMediaUrls];

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

// 8. Like / Unlike a comment (Bảo toàn nguyên bản)
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

// 9. Report a post (Bảo toàn nguyên bản)
exports.reportPost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { reason } = req.body;
    const reporterId = req.userId;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Lý do báo cáo là bắt buộc' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    if (post.userId.toString() === reporterId.toString()) {
      return res.status(400).json({ success: false, message: 'Bạn không thể báo cáo bài viết của chính mình' });
    }

    try {
      await Report.create({ postId, reporterId, reason: reason.trim() });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'Bạn đã báo cáo bài viết này rồi' });
      }
      throw err;
    }

    const updatedPost = await incrementReportCount(postId);

    res.status(201).json({
      success: true,
      message: 'Đã gửi báo cáo thành công',
      data: {
        reportCount: updatedPost.reportCount,
        status: updatedPost.status,
      },
    });
  } catch (error) {
    console.error('Report post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gửi báo cáo' });
  }
};