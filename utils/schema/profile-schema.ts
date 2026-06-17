import { model, models, Schema } from 'mongoose';
import { ProfileDocument } from '@/types/profile'

const profileSchema = new Schema<ProfileDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    followers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    following: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    posts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Post',
      },
    ],
    comments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Like',
      },
    ],
    report: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Report',
      }
    ],
    tribesCreated: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Tribe',
      },
    ],
    tribesJoined: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Tribe',
      }
    ]
  },
  {
    timestamps: true,
  }
);

export default models.Profile ?? model<ProfileDocument>('Profile', profileSchema);
