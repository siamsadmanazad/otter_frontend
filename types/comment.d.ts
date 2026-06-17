import { Document } from 'mongoose';
import { UserDocument } from './user.d';
import { PostDocument } from './post.d';

// Interface for Comment (without references resolved)
export interface Comment {
  content: string;
  owner: string | UserDocument; // Can be ID or populated user
  post: string | PostDocument;   // Can be ID or populated post
}

// Interface for CommentDocument (with Mongoose extensions)
export interface CommentDocument extends Comment, Document {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}