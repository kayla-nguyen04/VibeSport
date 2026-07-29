const { Schema, model } = require('mongoose');

const courtOwnerSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: null },
    picture: { type: String, default: null },
    district: { type: String, default: null },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    passwordHash: { type: String, default: null },
    provider: { type: String, default: 'email' },
    favoriteSport: { type: String, default: 'Bóng đá' },
    position: { type: String, default: '' },
    area: { type: String, default: '' },
    bio: { type: String, default: '' },
    rating: { type: Number, default: 0 },
    stats: {
      matchesPlayed: { type: Number, default: 0 },
      matchesWon: { type: Number, default: 0 },
      mvp: { type: Number, default: 0 },
    },
    profileCompleted: { type: Boolean, default: true },
    courts: [{ type: Schema.Types.ObjectId, ref: 'Court' }],
  },
  { timestamps: true }
);

module.exports = model('CourtOwner', courtOwnerSchema);
