import { model, models, Schema } from 'mongoose';
import { ReviewDocument } from '@/types/review';
import { v4 as uuidv4 } from 'uuid';

const reviewSchema = new Schema<ReviewDocument>(
  {
    serial: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
      immutable: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["REVIEW", "BUG_REPORT"],
      default: "REVIEW",
    },
    scope: {
      type: String,
      enum: [
        "FEED",
        "CHAT",
        "SEARCH",
        "PROFILE",
        "USER_INTERFACE",
        "USER_EXPERIENCE",
        "AI",
        "PERFORMANCE",
        "CONTENT",
        "OTHER",
      ],
      default: "USER_EXPERIENCE",
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    review: {
      type: String,
      required: false,
      maxlength: [1024, "Review must be less than 1024 characters"],
    },
    title: {
      type: String,
      required: false,
      maxlength: [128, "Review must be less than 1024 characters"],
    },
    description: {
      type: String,
      required: false,
      maxlength: [1024, "Description must be less than 1024 characters"],
    },
    media: {
      type: [
        {
          url: { type: String, required: true },
        },
      ],
      required: false,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default models.Reviews ?? model<ReviewDocument>('Reviews', reviewSchema);
