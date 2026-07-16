const { Schema, model } = require('mongoose');

const reportSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// 1 user chỉ report 1 bài 1 lần
reportSchema.index({ postId: 1, reporterId: 1 }, { unique: true });

module.exports = model('Report', reportSchema);
