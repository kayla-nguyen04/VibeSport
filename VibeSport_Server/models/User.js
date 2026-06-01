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
      default: undefined,
      sparse: true,
      unique: true,
    },
    name: {
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
  },
  {
    timestamps: true,
  }
);

module.exports = model('User', userSchema);
