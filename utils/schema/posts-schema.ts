import { model, models, Schema } from 'mongoose';
import { PostDocument } from '@/types/post';
import { v4 } from 'uuid';

const postSchema = new Schema<PostDocument>(
  {
    serial: {
      type: String,
      default: v4,
      required: true,
      unique: true,
    },
    image: [{
      type: String,
    }],
    likes: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }],
    caption: {
      type: String,
    },
    location: {
      type: String,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hashtags: [{
      type: String,
      required: false,
    }],
    postType: {
      type: String,
      enum: ['POST', 'JOURNAL'],
      default: 'POST',
    },
    fromGroup: {
      type: Schema.Types.ObjectId,
      ref: 'tribes',
      required: false,
    },
    comments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// either caption or image check
postSchema.pre('validate', function (next) {
  const post = this as PostDocument;

  const hasCaption = typeof post.caption === 'string' && post.caption.trim().length > 0;
  const hasImage = Array.isArray(post.image) && post.image.length > 0;

  if (!hasCaption && !hasImage) {
    next(new Error('At least one of caption or image is required'));
  } else {
    next();
  }
});

export default models.Post ?? model<PostDocument>('Post', postSchema);