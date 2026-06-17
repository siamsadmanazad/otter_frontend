import { model, models, Schema } from 'mongoose';
import { LikeDocument } from '@/types/like.d';

const likeSchema = new Schema<LikeDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate likes
likeSchema.index({ user: 1, post: 1 }, { unique: true });

export default models.Like ?? model<LikeDocument>('Like', likeSchema);