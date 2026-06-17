import { authOptions } from "@/auth";
import RateLimiter_Middleware from "@/lib/rate-limiter.middleware";
import { runDBOperationWithTransaction, runDBOperation } from "@/lib/useDB";
import Like from "@/utils/schema/like-schema";
import Post from "@/utils/schema/posts-schema";
import Profile from "@/utils/schema/profile-schema";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const postId = searchParams.get("postId");

  const likesData = await runDBOperation(async () => {
    const post = await Post.findById(postId)
      .populate({
        path: "likes",
        populate: {
          path: "user",
          model: "User",
        },
      })
      .exec();

    return post?.likes || [];
  });

  return Response.json({
    message: "Retrieved likes",
    status: 200,
    data: likesData,
  });
}

interface LikeToggleResult {
  isLiked: boolean;
  likeCount: number;
  likeId?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Authentication check
    const userData = await getServerSession(authOptions);
    const userId = userData?.user?.id;

    if (!userId) {
      return Response.json(
        { message: "Unauthorized", status: 401 },
        { status: 401 }
      );
    }

    // Rate limiting
    await RateLimiter_Middleware(request);

    // Parse and validate request body
    const body = await request.json();
    const { post: postId } = body;

    if (!postId?.trim()) {
      return Response.json(
        { message: "Post ID is required", status: 400 },
        { status: 400 }
      );
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return Response.json(
        { message: "Invalid post ID format", status: 400 },
        { status: 400 }
      );
    }

    const result = await runDBOperationWithTransaction(
      async (): Promise<LikeToggleResult> => {
        // Check if post exists and if user already liked it
        const [post, existingLike] = await Promise.all([
          Post.findById(postId).select("likes owner").lean() as any,
          Like.findOne({ user: userId, post: postId }).lean() as any,
        ]);

        if (!post) {
          throw new Error("Post not found");
        }

        const hasLiked = !!existingLike;

        if (hasLiked) {
          // Unlike: Remove like from all three places
          await Promise.all([
            // Remove user ID from post's likes array
            Post.findByIdAndUpdate(postId, { $pull: { likes: userId } }),
            // Remove like document ID from profile's likes array
            Profile.findOneAndUpdate(
              { user: userId },
              { $pull: { likes: existingLike._id } }
            ),
            // Delete the like document
            Like.findByIdAndDelete(existingLike._id),
          ]);

          return {
            isLiked: false,
            likeCount: Math.max(0, post.likes.length - 1), // Ensure non-negative count
          };
        } else {
          // Like: Add like to all three places
          const newLike = new Like({ user: userId, post: postId });
          const savedLike = await newLike.save();

          // Update post and profile in parallel
          await Promise.all([
            // Add user ID to post's likes array
            Post.findByIdAndUpdate(postId, { $addToSet: { likes: userId } }),
            // Add like document ID to profile's likes array
            Profile.findOneAndUpdate(
              { user: userId },
              { $addToSet: { likes: savedLike._id } },
              { upsert: true } // Create profile if it doesn't exist
            ),
          ]);

          return {
            isLiked: true,
            likeCount: post.likes.length + 1,
            likeId: savedLike._id.toString(),
          };
        }
      }
    );

    return Response.json({
      message: result.isLiked
        ? "Post liked successfully"
        : "Post unliked successfully",
      status: 200,
      data: {
        isLiked: result.isLiked,
        likeCount: result.likeCount,
        likeId: result.likeId || null,
      },
    });
  } catch (error) {
    console.error("Error toggling like:", error);

    // Handle duplicate key error (race condition)
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return Response.json(
        {
          message: "Like already exists",
          status: 409,
        },
        { status: 409 }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage === "Post not found" ? 404 : 500;

    return Response.json(
      {
        message: errorMessage,
        status: statusCode,
      },
      { status: statusCode }
    );
  }
}

export async function DELETE(request: Request) {
  const userData = await getServerSession(authOptions);
  const userId = userData?.user?.id;

  if (!userId) {
    return Response.json(
      { message: "Unauthorized", status: 401 },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { postId } = body;

    const deletedLike = await runDBOperationWithTransaction(async () => {
      const like = await Like.findOneAndDelete({ user: userId, post: postId });

      if (!like) {
        throw new Error("Like not found");
      }
      await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } });
      await Profile.findOneAndUpdate(
        { user: userId },
        { $pull: { likes: like._id } }
      );

      return like;
    });

    return Response.json({
      message: "Post unliked",
      status: 200,
      data: deletedLike,
    });
  } catch (err) {
    console.error(err);
    return Response.json({
      message: "Error unliking post",
      status: 500,
      data: err,
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
