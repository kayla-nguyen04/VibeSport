const { Schema, model } = require('mongoose');

const postSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      default: '',
    },
    mediaUrls: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      default: '',
    },
    sportType: {
      type: String,
      default: 'Bóng đá',
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    sharesCount: {
      type: Number,
      default: 0,
    },
    // Moderation fields - soft delete vi phạm
    status: {
      type: String,
      enum: ['active', 'removed_by_admin', 'hidden', 'pending_review'],
      default: 'active',
      index: true,
    },
    removalReason: {
      type: String,
      default: null,
    },
    removalCategory: {
      type: String,
      enum: ['spam', 'ngôn từ thù ghét', 'nội dung không phù hợp', 'vi phạm bản quyền', 'other', null],
      default: null,
    },
    removedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    // Report tracking
    reportCount: {
      type: Number,
      default: 0,
    },
    lastReportedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model('Post', postSchema);
