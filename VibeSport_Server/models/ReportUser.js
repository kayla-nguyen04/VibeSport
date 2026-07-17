const { Schema, model } = require('mongoose');

const reportUserSchema = new Schema(
  {
    reportedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
      enum: ['pending', 'resolved', 'ignored'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// 1 user chỉ báo cáo 1 user khác 1 lần duy nhất để tránh spam
reportUserSchema.index({ reportedUserId: 1, reporterId: 1 }, { unique: true });

module.exports = model('ReportUser', reportUserSchema);
