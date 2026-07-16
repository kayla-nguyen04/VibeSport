const { Schema, model } = require('mongoose');

const taskSchema = new Schema(
  {
    sprintId: {
      type: Schema.Types.ObjectId,
      ref: 'Sprint',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model('Task', taskSchema);
