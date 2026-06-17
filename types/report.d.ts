import { Document } from 'mongoose';
import { UserDocument } from '@/types/user';
import { ProfileDocument } from '@/types/profile';
import { PostDocument } from '@/types/post';
import { CommentDocument } from '@/types/comment';

export interface ReportDocument extends Document {
  reportedBy: ProfileDocument["_id"];
  reportedUser: ProfileDocument["_id"];
  scope: string;
  reason: string;
  reasonDescription?: string;
  relatedComment?: CommentDocument["_id"];
  relatedPost?: PostDocument["_id"];
  status: "PENDING" | "REVIEWED" | "RESOLVED";
  createdAt: Date;
  updatedAt: Date;
}