import { model, models, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { NewsLetterDocument } from "@/types/newsletter";

const newsLetter = new Schema<NewsLetterDocument>(
  {
    serial: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
      immutable: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      email: [true, "Please enter a valid email address"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    location: {
      type: String,
      required: false,
      maxlength: [100, "Location must be less than 100 characters"],
    },
  },
  {
    timestamps: true,
  }
);

export default models.NewsLetter ?? model<NewsLetterDocument>("NewsLetter", newsLetter);
