const { Schema, model } = require('mongoose');

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['follow', 'message', 'match', 'system', 'like', 'comment', 'reply'],
      default: 'system',
    },
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    message: {
      type: String,
      required: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    postThumbnail: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = model('Notification', notificationSchema);
