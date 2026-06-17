import { model, models, Schema } from "mongoose";
import { v4 } from "uuid";
import { MediaDocument } from "@/types/media";

const mediaSchema = new Schema<MediaDocument>(
  {
    serial: {
      type: String,
      default: v4,
      required: true,
      unique: true,
    },
    mediaType: {
      type: String,
      enum: ['VIDEO', 'IMAGE']
    },
    documentId: {
      type: String,
      required: true,
    },
    assetId: {
      type: String,
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

export default models.Media ?? model<MediaDocument>("media", mediaSchema);
