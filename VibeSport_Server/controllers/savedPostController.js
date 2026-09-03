const SavedPost = require('../models/SavedPost');
    const Post = require('../models/Post');
    const PostLike = require('../models/PostLike');
    const { enrichPostTags } = require('../utils/tagHelpers');

    exports.savePost = async (req, res) => {
      try {
        const { postId } = req.params;
        const userId = req.userId;

        const post = await Post.findById(postId);
        if (!post) {
          return res.status(404).json({ success: false, message: 'Bài viết không tồn tại hoặc đã bị xóa' });
        }

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

    exports.getSavedPosts = async (req, res) => {
      try {
        const userId = req.userId;

        
        const savedList = await SavedPost.find({ userId })
          .populate({
            path: 'postId',
            populate: {
              path: 'userId',
              select: 'name picture favoriteSport',
            },
          })
          .sort({ createdAt: -1 });

        const activeSaved = savedList.filter(item => item.postId !== null);

        const mappedPosts = await Promise.all(
          activeSaved.map(async (item) => {
            const post = item.postId;
            let isLiked = false;
            let reactionType = null;

            const like = await PostLike.findOne({ postId: post._id, userId });
            if (like) {
              isLiked = true;
              reactionType = like.reactionType;
            }

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
              isSaved: true, 
              savedAt: item.createdAt, 
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
