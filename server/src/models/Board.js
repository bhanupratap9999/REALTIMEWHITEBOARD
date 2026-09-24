import mongoose from 'mongoose';

const BoardSchema = new mongoose.Schema(
  {
    boardId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: 'Untitled Board',
      trim: true,
    },
    version: {
      type: Number,
      default: 0,
      min: 0,
    },
    objects: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const Board = mongoose.models.Board || mongoose.model('Board', BoardSchema);
