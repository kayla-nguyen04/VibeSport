const SavedPost = require('../models/SavedPost');
    const Post = require('../models/Post');
    const PostLike = require('../models/PostLike');
    const { enrichPostTags } = require('../utils/tagHelpers');

    // 1. Save a post
    exports.savePost = async (req, res) => {
      try {
        const { postId } = req.params;
        const userId = req.userId;

        // Check if post exists
        const post = await Post.findById(postId);
        if (!post) {
          return res.status(404).json({ success: false, message: 'Bài viết không tồn tại hoặc đã bị xóa' });
        }

        // Check if already saved
        const existingSaved = await SavedPost.findOne({ userId, postId });
        if (existingSaved) {
          return res.status(400).json({ success: false, message: 'Bạn đã lưu bài viết này rồi' });
        }

        const newSaved = new SavedPost({ userId, postId });
        await newSaved.save();

        res.status(201).json({
          success: true,
          message: 'Đã lưu bài viết',
        });
      } catch (error) {
        console.error('Save post error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lưu bài viết' });
      }
    };

    // 2. Unsave a post
    exports.unsavePost = async (req, res) => {
      try {
        const { postId } = req.params;
        const userId = req.userId;

        const result = await SavedPost.deleteOne({ userId, postId });
        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, message: 'Bài viết chưa được lưu hoặc đã bỏ lưu trước đó' });
        }

        res.status(200).json({
          success: true,
          message: 'Đã bỏ lưu bài viết',
        });
      } catch (error) {
        console.error('Unsave post error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi bỏ lưu bài viết' });
      }
    };

    // 3. Get list of saved posts
    exports.getSavedPosts = async (req, res) => {
      try {
        const userId = req.userId;

        // Find all saved posts for this user, populate the post details
        // and nested populate the author of the post (userId)
        const savedList = await SavedPost.find({ userId })
          .populate({
            path: 'postId',
            populate: {
              path: 'userId',
              select: 'name picture favoriteSport',
            },
          })
          .sort({ createdAt: -1 });

        // Filter out items where postId is null (meaning the original post was deleted)
        const activeSaved = savedList.filter(item => item.postId !== null);

        // Map to return a clean list of posts with isSaved: true, isLiked, etc.
        const mappedPosts = await Promise.all(
          activeSaved.map(async (item) => {
            const post = item.postId;
            let isLiked = false;
            let reactionType = null;

            // Check if user liked the post
            const like = await PostLike.findOne({ postId: post._id, userId });
            if (like) {
              isLiked = true;
              reactionType = like.reactionType;
            }

            // Get top 2 reactions
            const reactionsCount = await PostLike.aggregate([
              { $match: { postId: post._id } },
              { $group: { _id: '$reactionType', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 2 }
            ]);
            const topReactions = reactionsCount.map(r => r._id);

            return {
              ...enrichPostTags(post),
              isLiked,
              reactionType,
              topReactions,
              isSaved: true, // Mark as saved
              savedAt: item.createdAt, // Add save time
            };
          })
        );

        res.status(200).json({
          success: true,
          data: mappedPosts,
        });
      } catch (error) {
        console.error('Get saved posts error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách bài viết đã lưu' });
      }
    };
