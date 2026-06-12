const { Schema, model } = require('mongoose');

const savedPostSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure a user can save a post only once
savedPostSchema.index({ userId: 1, postId: 1 }, { unique: true });

module.exports = model('SavedPost', savedPostSchema);
