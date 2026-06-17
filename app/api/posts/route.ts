import { runDBOperation, runDBOperationWithTransaction } from "@/lib/useDB";
import postsSchema from "@/utils/schema/posts-schema";
import profileSchema from "@/utils/schema/profile-schema";
import { NextRequest } from "next/server";
import mongoose from "mongoose";

import "@/utils/schema/comments-schema";
import "@/utils/schema/like-schema";
import "@/utils/schema/user-schema";

interface IPostBody {
  owner: string;
  image?: string[] | undefined;
  likes?: string[] | undefined;
  caption?: string | undefined;
  location?: string | undefined;
  comments?: string[] | undefined;
  fromGroup?: string;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const postId = searchParams.get("postId");

    // Validate postId
    if (!postId?.trim()) {
      return Response.json(
        {
          message: "Post ID is required",
          status: 400,
        },
        { status: 400 }
      );
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return Response.json(
        {
          message: "Invalid post ID format",
          status: 400,
        },
        { status: 400 }
      );
    }

    const post = await runDBOperation(async () => {
      return (await postsSchema
        .findById(postId)
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
            sort: { createdAt: -1 }, // Sort comments by newest first
          },
        })
        .lean()
        .exec()) as any;
    });

    if (!post) {
      return Response.json(
        {
          message: "Post not found",
          status: 404,
        },
        { status: 404 }
      );
    }

    const enhancedPost = {
      ...post,
      stats: {
        likesCount: post.likes?.length || 0,
        commentsCount: post.comments?.length || 0,
        hasImage: Array.isArray(post.image) && post.image.length > 0,
        hasCaption:
          typeof post.caption === "string" && post.caption.trim().length > 0,
      },
      comments: post.comments || [],
      likedBy: post.likes || [],
    };

    return Response.json({
      message: "Post retrieved successfully",
      status: 200,
      data: enhancedPost,
    });
  } catch (error) {
    console.error("Error fetching post:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    return Response.json(
      {
        message: errorMessage,
        status: 500,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const postBody = (await request.json()) as IPostBody;
  try {
    const createPost = await runDBOperationWithTransaction(async () => {
      const hashtags = postBody.caption?.match(/#[a-zA-Z0-9]+/g) || [];
      let newPost: any;
      if (postBody.fromGroup) {
        newPost = new postsSchema({
          ...postBody,
          hashtags,
          fromGroup: postBody.fromGroup,
        });
        await newPost.save();
        return newPost;
      } else {
        newPost = new postsSchema({
          ...postBody,
          hashtags,
        });
      }
      await newPost.save();

      const updateResult = await profileSchema.findOneAndUpdate(
        { user: postBody.owner },
        { $push: { posts: newPost._id } },
        { new: true, upsert: true }
      );

      return { newPost, updateResult };
    });
    return Response.json({
      message: "Post uploaded!",
      status: 200,
      data: createPost,
    });
  } catch (error: unknown) {
    const errResponse = error as { message: string; code: number };
    return Response.json({
      message: "Error uploading post",
      status: 500,
      error: errResponse.message,
    });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const postBody = await request.json();
    const { postId, caption, location } = postBody;

    // Basic validation: Ensure postId and at least one updateable field are present
    if (!postId) {
      return Response.json(
        {
          message: "Post ID is required for update.",
          status: 400,
        },
        { status: 400 }
      );
    }

    if (caption === undefined && location === undefined) {
      return Response.json(
        {
          message: "No updateable fields provided (caption or location).",
          status: 400,
        },
        { status: 400 }
      );
    }

    // Construct the update object with only the allowed fields
    const updateFields: { caption?: string; location?: string } = {};
    if (caption !== undefined) {
      updateFields.caption = caption;
    }
    if (location !== undefined) {
      updateFields.location = location;
    }

    const updatePost = await runDBOperation(async () => {
      // Use findByIdAndUpdate with the specific fields to update
      const updatedPost = await postsSchema.findByIdAndUpdate(
        postId,
        updateFields, // Pass only the fields to be updated
        { new: true, runValidators: true } // `new: true` returns the updated document, `runValidators: true` runs schema validators
      );
      return updatedPost;
    });

    if (!updatePost) {
      return Response.json(
        {
          message: "Post not found.",
          status: 404,
        },
        { status: 404 }
      );
    }

    return Response.json(
      {
        message: "Post updated successfully!",
        status: 200,
        data: updatePost,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error updating post:", error); // Log the full error for debugging

    // More robust error handling for different types of errors
    if (error instanceof Error) {
      return Response.json(
        {
          message: "Error updating post",
          status: 500,
          error: error.message,
        },
        { status: 500 }
      );
    } else {
      return Response.json(
        {
          message: "An unknown error occurred",
          status: 500,
          error: String(error),
        },
        { status: 500 }
      );
    }
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const postId = searchParams.get("id");
    if (!postId) {
      return Response.json({
        message: "Post ID is required for deletion.",
        status: 400,
      });
    }
    const deletePost = await runDBOperation(async () => {
      const deletedPost = await postsSchema.findByIdAndDelete(postId);
      return deletedPost;
    });
    if (!deletePost) {
      return Response.json({
        message: "Post not found.",
        status: 404,
      });
    }
    return Response.json({
      message: "Post deleted successfully!",
      status: 200,
      data: deletePost,
    });
  } catch (err) {
    console.log(err);
    return Response.json({
      message: "Error deleting post",
      status: 500,
      error: err,
    });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
