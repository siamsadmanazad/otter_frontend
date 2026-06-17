import { TribeDocument } from '@/types/tribes.d';
import { model, models, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const tribeSchema = new Schema<TribeDocument>(
  {
    serial: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
      immutable: true,
    },
    description: {
      type: String,
      required: false,
      maxlength: [4096, "Description must be less than 4096 characters"],
    },
    category: {
      type: String,
      enum: [
        "JOURNEY",
        "LOCATION",
        "COMMUNITY",
        "FOOD",
        "BIKERS",
        "CYCLISTS",
        "LONG_TRAVEL",
        "ABROAD",
      ],
      default: "COMMUNITY",
    },
    tags: {
      type: [String],
    },
    coverImage: {
      type: String,
      required: false,
    },
    profileImage: {
      type: String,
      required: false,
    },
    name: {
      type: String,
      required: [true, "Tribe name is required"],
      minlength: [2, "Tribe name must be at least 2 characters"],
      maxlength: [50, "Tribe name must be less than 50 characters"],
    },
    users: [
      {
        type: Schema.Types.ObjectId,
        ref: "Profile",
        unique: true,
      },
    ],
    posts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Post",
        unique: true,
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
    },
    privacy: {
      type: String,
      enum: ["PUBLIC", "PRIVATE"],
      default: "PUBLIC",
    },
  },
  {
    timestamps: true,
  }
);


export default models.Tribe ?? model<TribeDocument>("Tribe", tribeSchema);
