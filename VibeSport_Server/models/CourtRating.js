const { Schema, model } = require('mongoose');

const courtRatingSchema = new Schema(
  {
    court: { type: Schema.Types.ObjectId, ref: 'Court', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = model('CourtRating', courtRatingSchema);
