import { NextRequest } from "next/server";
import { runDBOperation, runDBOperationWithTransaction } from "@/lib/useDB";

import profileSchema from "@/utils/schema/profile-schema";
import userSchema from "@/utils/schema/user-schema";
import mongoose from "mongoose";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

import "@/utils/schema/comments-schema";
import "@/utils/schema/like-schema";
import "@/utils/schema/posts-schema";

interface UserDataOptimized {
  _id: string;
  username?: string;
  fullName?: string;
  profileImage?: string;
  profile: {
    postsCount: number;
    commentsCount: number;
    followersCount: number;
    followingCount: number;
    createdAt: Date;
    updatedAt: Date;
    _id: number;
  };
  [key: string]: any;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("id");

    if (!userId?.trim()) {
      return new Response(
        JSON.stringify({ message: "User ID is required", status: 400 }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return new Response(
        JSON.stringify({ message: "Invalid user ID format", status: 400 }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await runDBOperation(async () => {
      const [user, userProfile] = await Promise.all([
        userSchema
          .findById(userId)
          .select(
            "username fullName profileImage coverImage _id bio location socials email active role createdAt updatedAt"
          )
          .lean()
          .exec() as any,

        profileSchema
          .aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            {
              $project: {
                _id: 1,
                postsCount: { $size: "$posts" },
                commentsCount: { $size: "$comments" },
                followersCount: { $size: "$followers" },
                followingCount: { $size: "$following" },
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ])
          .exec(),
      ]);

      if (!user) {
        throw new Error("User not found");
      }

      const profileCounts = userProfile[0] || {};

      const userData: UserDataOptimized = {
        ...user,
        profile: {
          _id: profileCounts._id,
          postsCount: profileCounts.postsCount || 0,
          commentsCount: profileCounts.commentsCount || 0,
          followersCount: profileCounts.followersCount || 0,
          followingCount: profileCounts.followingCount || 0,
          createdAt: profileCounts.createdAt,
          updatedAt: profileCounts.updatedAt,
        },
      };

      return userData;
    });

    return Response.json({
      message: "User data retrieved successfully",
      status: 200,
      data,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage === "User not found" ? 404 : 500;

    return new Response(
      JSON.stringify({
        message: errorMessage,
        status: statusCode,
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function POST(request: Request) {
  return Response.json({
    message: "Hello World",
    status: 200,
    method: request.method,
  });
}

export async function PATCH(request: NextRequest) {
  const postBody = await request.json();
  const userId = await getServerSession(authOptions);
  const data = await runDBOperationWithTransaction(async (session) => {
    const user = await userSchema.findByIdAndUpdate(
      { _id: userId?.user?.id },
      { $set: postBody },
      { new: true, session }
    );
    return user;
  });
  return Response.json({
    message: "Profile Updated!",
    status: 200,
    data,
  });
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
