import { model, models, Schema } from 'mongoose';
import { CommentDocument } from '@/types/comment';

const commentSchema = new Schema<CommentDocument>(
  {
    content: {
      type: String,
      required: true,
      maxlength: [1024, 'Comment must be less than 1024 characters'],
    },
    owner: {
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

export default models.Comment ?? model<CommentDocument>('Comment', commentSchema);