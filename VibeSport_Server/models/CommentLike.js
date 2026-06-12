const { Schema, model } = require('mongoose');

const commentLikeSchema = new Schema(
  {
    commentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Tránh trùng lặp like từ một người dùng trên một cmt
commentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });

module.exports = model('CommentLike', commentLikeSchema);
