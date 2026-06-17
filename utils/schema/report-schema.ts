import { model, models, Schema } from 'mongoose';
import '@/types/profile'
import { ReportDocument } from '@/types/report';

const reportSchema = new Schema<ReportDocument>(
  {
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
    },
    reportedUser: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
    },
    scope: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    reasonDescription: {
      type: String,
      required: false,
      trim: true,
    },
    relatedComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
    relatedPost: {
      type: Schema.Types.ObjectId,
      ref: "Post",
    },
    status: {
      type: String,
      default: "PENDING",
    },
  },
  {
    timestamps: true,
  }
);

export default models.Report ?? model('Report', reportSchema);
