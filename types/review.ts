import { Document, Types } from "mongoose";

interface Media {
  url: string;
}

export interface ReviewDocument extends Document {
  serial: string;
  type: "REVIEW" | "BUG_REPORT";
  scope:
    | "FEED"
    | "CHAT"
    | "SEARCH"
    | "PROFILE"
    | "USER_INTERFACE"
    | "USER_EXPERIENCE"
    | "AI"
    | "PERFORMANCE"
    | "CONTENT"
    | "OTHER";
  review?: string;
  status?: string;
  title?: string;
  description?: string;
  media?: Media[];
  user: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
