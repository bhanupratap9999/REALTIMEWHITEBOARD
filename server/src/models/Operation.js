import mongoose from 'mongoose';

const OperationSchema = new mongoose.Schema(
  {
    operationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    boardId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['ADD', 'MOVE', 'UPDATE', 'RESIZE', 'ROTATE', 'DELETE', 'TEXT_UPDATE', 'CLEAR', 'NOOP'],
    },
    objectId: {
      type: String,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    baseVersion: {
      type: Number,
      required: true,
    },
    serverVersion: {
      type: Number,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    transformed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Operation = mongoose.models.Operation || mongoose.model('Operation', OperationSchema);
