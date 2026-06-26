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
    deletedAtByUser: {
      type: Schema.Types.Mixed,
      default: {},
    },
    mutedByUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // === Group Permissions ===
    admin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    coAdmins: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    mutedMembers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // === Nicknames ===
    nicknames: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // === Invite Link ===
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    inviteLinkEnabled: {
      type: Boolean,
      default: false,
    },
    // === Join Requests (yêu cầu tham gia nhóm chờ duyệt) ===
    joinRequests: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        requestedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // === Added-by tracking for participants ===
    addedBy: {
      type: Schema.Types.Mixed,
      default: {},
    },
    pinnedMessage: {
      messageId: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
      },
      pinnedAt: {
        type: Date,
        default: null,
      },
      pinnedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
    pinnedMessages: [
      {
        messageId: {
          type: Schema.Types.ObjectId,
          ref: 'Message',
          required: true,
        },
        pinnedAt: {
          type: Date,
          default: Date.now,
        },
        pinnedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = model('Conversation', conversationSchema);
