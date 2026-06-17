import { runDBOperation } from "@/lib/useDB";
import postsSchema from "@/utils/schema/posts-schema";
import mongoose from "mongoose";
import "@/utils/schema/comments-schema";
import "@/utils/schema/like-schema";
import "@/utils/schema/user-schema";

export default async function GetPost(id: string) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const post = await runDBOperation(async () => {
      return await postsSchema
        .findById(id)
        .populate({
          path: "owner",
          model: "User",
          select:
            "_id username fullName profileImage bio location role createdAt",
        })
        .populate({
          path: "likes",
          model: "User",
          select: "_id username fullName profileImage",
        })
        .populate({
          path: "comments",
          model: "Comment",
          select: "_id content createdAt updatedAt",
          populate: {
            path: "owner",
            model: "User",
            select: "_id username fullName profileImage",
          },
          options: {
            sort: { createdAt: -1 },
          },
        })
        .lean()
        .exec();
    });

    if (!post) {
      return null;
    }

      // Serialize the entire object to convert ObjectIds to strings
      // or else it fails because we cannot send objectified json to client component
    const serializedPost = JSON.parse(JSON.stringify(post));

    const enhancedPost = {
      ...serializedPost,
      stats: {
        likesCount: serializedPost.likes?.length || 0,
        commentsCount: serializedPost.comments?.length || 0,
        hasImage:
          Array.isArray(serializedPost.image) &&
          serializedPost.image.length > 0,
        hasCaption:
          typeof serializedPost.caption === "string" &&
          serializedPost.caption.trim().length > 0,
      },
      comments: serializedPost.comments || [],
      likedBy: serializedPost.likes || [],
    };

    return enhancedPost;
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
}
