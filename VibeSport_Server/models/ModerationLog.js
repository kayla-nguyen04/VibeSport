const { Schema, model } = require('mongoose');

const moderationLogSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['spam', 'ngôn từ thù ghét', 'nội dung không phù hợp', 'vi phạm bản quyền', 'other'],
      default: 'other',
    },
    action: {
      type: String,
      enum: ['removed', 'warning', 'restored'],
      default: 'removed',
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model('ModerationLog', moderationLogSchema);
