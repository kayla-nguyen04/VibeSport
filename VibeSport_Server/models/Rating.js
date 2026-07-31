const { Schema, model } = require('mongoose');

const ratingSchema = new Schema(
  {
    fromUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    matchId: {
      type: Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
    },
    stars: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Khóa chỉ mục tránh 1 người đánh giá trùng lặp 1 người 2 lần trong cùng 1 trận đấu
ratingSchema.index({ fromUser: 1, toUser: 1, matchId: 1 }, { unique: true });

module.exports = model('Rating', ratingSchema);