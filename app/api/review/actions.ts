import reviewSchema from "@/utils/schema/review-schema";
import { runDBOperation } from "@/lib/useDB";
import type { ReviewDocument } from "@/types/review";

interface CreateReviewInput {
  type?: "REVIEW" | "BUG_REPORT";
  scope?:
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
  title?: string;
  description?: string;
  media?: { url: string }[];
}

interface UpdateReviewInput {
  type?: "REVIEW" | "BUG_REPORT";
  scope?:
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
  title?: string;
  description?: string;
  media?: { url: string }[];
}

export async function createReview(
  data: CreateReviewInput
): Promise<ReviewDocument | null> {
  try {
    const newReview = await runDBOperation(async () => {
      const review = new reviewSchema(data);
      await review.save();
      return review;
    });
    return JSON.parse(JSON.stringify(newReview));
  } catch (error) {
    console.error("Error creating review:", error);
    return null;
  }
}

export async function getReviewById(id: string) {
  try {
    const review = await runDBOperation(
      async () => await reviewSchema.findById(id).lean().exec()
    );
    if (!review) {
      return null;
    }
    return review;
  } catch (error) {
    console.error(`Error fetching review with ID ${id}:`, error);
    return null;
  }
}

export async function getAllReviews({
  page,
  limit,
}: {
  page: number;
  limit: number;
}): Promise<ReviewDocument[]> {
  try {
    const reviews = await runDBOperation(
      async () =>
        await reviewSchema
          .find()
          .skip((page - 1) * limit)
          .limit(limit)
          .populate({
            path: "user",
            select: "username email fullName profileImage",
          })
          .sort({ createdAt: -1 })
          .lean()
          .exec()
    );
    return JSON.parse(JSON.stringify(reviews));
  } catch (error) {
    console.error("Error fetching all reviews:", error);
    return [];
  }
}

export async function updateReview(
  id: string,
  updates: UpdateReviewInput
): Promise<ReviewDocument | null> {
  try {
    const updatedReview = await runDBOperation(
      async () =>
        await reviewSchema.findByIdAndUpdate(id, updates, { new: true })
    );
    if (!updatedReview) {
      return null;
    }
    return JSON.parse(JSON.stringify(updatedReview));
  } catch (error) {
    console.error(`Error updating review with ID ${id}:`, error);
    return null;
  }
}

export async function deleteReview(id: string): Promise<boolean> {
  try {
    const result = await runDBOperation(
      async () => await reviewSchema.findByIdAndDelete(id)
    );
    return !!result;
  } catch (error) {
    console.error(`Error deleting review with ID ${id}:`, error);
    return false;
  }
}
