const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      default: null,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    name: {
      type: String,
      default: null,
    },

    phone: {
      type: String,
      default: null,
    },

    picture: {
      type: String,
      default: null,
    },

    provider: {
      type: String,
      enum: ['email', 'google'],
      default: 'email',
    },
    favoriteSport: {
      type: String,
      default: null,
    },
    position: {
      type: String,
      default: null,
    },
    area: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: null,
    },
    featuredPost: {
      type: String,
      default: null,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model('User', userSchema);