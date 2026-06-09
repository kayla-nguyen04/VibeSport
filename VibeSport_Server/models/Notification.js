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
      enum: ['follow', 'message', 'match', 'system'],
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
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = model('Notification', notificationSchema);
