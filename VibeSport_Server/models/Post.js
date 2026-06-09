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
  },
  {
    timestamps: true,
  }
);

module.exports = model('Post', postSchema);
