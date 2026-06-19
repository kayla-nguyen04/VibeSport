const { Schema, model } = require('mongoose');

const conversationSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: '',
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: '',
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadByUser: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['active', 'pending'],
      default: 'pending',
    },
    acceptedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    acceptedAt: {
      type: Date,
      default: null,
    },
    pendingMessages: [
      {
        senderId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    blockedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletedByUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    mutedByUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

module.exports = model('Conversation', conversationSchema);
