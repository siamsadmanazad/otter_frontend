import { Document } from 'mongoose';
import { UserDocument } from './user.d';
import { PostDocument } from './post.d';

export interface Like {
  user: string | UserDocument;
  post: string | PostDocument;
}

export interface LikeDocument extends Like, Document {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}
