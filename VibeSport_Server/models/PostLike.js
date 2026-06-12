const { Schema, model } = require('mongoose');

const postLikeSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reactionType: {
      type: String,
      enum: ['like', 'love', 'haha'],
      default: 'like',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure a user can only like a post once
postLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });

module.exports = model('PostLike', postLikeSchema);
