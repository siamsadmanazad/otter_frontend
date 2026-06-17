import { Document, Types } from 'mongoose';
import { UserDocument } from './user';
import { PostDocument } from './post';
import { CommentDocument } from './comment';
import { LikeDocument } from './like';
import { ReportDocument } from './report';
import { TribeDocument } from './tribes';

export interface ProfileDocument extends Document {
  user: Types.ObjectId;
  followers: UserDocument["_id"][];
  following: UserDocument["_id"][];
  posts: PostDocument["_id"][];
  comments: CommentDocument["_id"][];
  likes: LikeDocument["_id"][];
  report: ReportDocument["_id"][];
  tribesCreated: TribeDocument["_id"][];
  tribesJoined: TribeDocument["_id"][];
}
