const { Schema, model } = require('mongoose');

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.type !== 'call';
      },
    },
    // Loại tin nhắn: 'text' (mặc định), 'image', hoặc 'call' (tin nhắn hệ thống cuộc gọi)
    type: {
      type: String,
      enum: ['text', 'image', 'call'],
      default: 'text',
    },
    content: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    // URL ảnh (chỉ dùng khi type === 'image')
    mediaUrl: {
      type: String,
      default: null,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isRecalled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = model('Message', messageSchema);

