const { Schema, model } = require('mongoose');

const teamMemberSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      default: 'Thành viên',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const teamSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logo: {
      type: String,
      default: '',
    },
    sport: {
      type: String,
      default: 'Bóng đá',
    },
    area: {
      type: String,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    members: {
      type: [teamMemberSchema],
      default: [],
    },
  },
  { timestamps: true }
);

teamSchema.index({ 'members.userId': 1 });

module.exports = model('Team', teamSchema);
