import { authOptions } from "@/auth";
import RateLimiter_Middleware from "@/lib/rate-limiter.middleware";
import { runDBOperationWithTransaction, runDBOperation } from "@/lib/useDB";
import Profile from "@/utils/schema/profile-schema";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import userSchema from "@/utils/schema/user-schema";

/**
 * @interface FollowToggleResult
 * @description Defines the structure of the result returned after a follow/unfollow operation.
 * @property {boolean} isFollowing - Indicates whether the user is now following the target user.
 * @property {number} followersCount - The updated number of followers for the target user.
 * @property {number} followingCount - The updated number of users the current user is following.
 */
interface FollowToggleResult {
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

/**
 * @function GET
 * @description Handles GET requests to retrieve followers or following list for a given profile.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {Response} A JSON response containing the list of followers/following or an error message.
 */
export async function GET(request: NextRequest): Promise<Response> {
 const searchParams = request.nextUrl.searchParams;
 const profileId = searchParams.get("profileId");

 // Validate profileId format
 if (!profileId || !mongoose.Types.ObjectId.isValid(profileId)) {
   return Response.json(
     { message: "Invalid or missing profile ID", status: 400 },
     { status: 400 }
   );
 }

 try {
   const profileData = await runDBOperation(async () => {
     let profileQuery = await Profile.findOne({ user: profileId}).populate([
       {
         path: "followers",
         select: "username fullName location profileImage",
         model: "User",
       },
       {
         path: "following",
         select: "username fullName location profileImage",
         model: "User",
       }
     ]).select("following followers");
     return profileQuery;
   });

   return Response.json({
     message: `Retrieved successfully`,
     status: 200,
     data: profileData,
   });
 } catch (error) {
   console.error("Error retrieving followers/following:", error);
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

/**
 * @function POST
 * @description Handles POST requests to toggle a follow relationship between users.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {Promise<Response>} A JSON response indicating the success or failure of the operation.
 */
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
    const { targetUserId } = body;

    if (!targetUserId?.trim()) {
      return Response.json(
        { message: "Target User ID is required", status: 400 },
        { status: 400 }
      );
    }

    // Prevent a user from following themselves
    if (userId === targetUserId) {
      return Response.json(
        { message: "Cannot follow yourself", status: 400 },
        { status: 400 }
      );
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return Response.json(
        { message: "Invalid target user ID format", status: 400 },
        { status: 400 }
      );
    }

    const result = await runDBOperationWithTransaction(
      async (): Promise<FollowToggleResult> => {
        // Find the current user's profile and the target user's profile
        const [userProfile, targetProfile] = await Promise.all([
          Profile.findOneAndUpdate(
            { user: userId },
            { $setOnInsert: { user: userId } }, // Create profile if it doesn't exist
            { upsert: true, new: true }
          ).lean() as any,
          Profile.findOneAndUpdate(
            { user: targetUserId },
            { $setOnInsert: { user: targetUserId } }, // Create profile if it doesn't exist
            { upsert: true, new: true }
          ).lean() as any,
        ]);

        if (!userProfile || !targetProfile) {
          throw new Error(
            "User or Target User profile not found (should not happen with upsert)"
          );
        }

        // Check if the current user is already following the target user
        const isFollowing = userProfile.following.includes(targetUserId);

        let newFollowersCount = targetProfile.followers.length;
        let newFollowingCount = userProfile.following.length;

        if (isFollowing) {
          // Unfollow: Remove targetUserId from current user's following and userId from target's followers
          await Promise.all([
            Profile.findByIdAndUpdate(userProfile._id, {
              $pull: { following: targetUserId },
            }),
            Profile.findByIdAndUpdate(targetProfile._id, {
              $pull: { followers: userId },
            }),
          ]);
          newFollowingCount = Math.max(0, newFollowingCount - 1);
          newFollowersCount = Math.max(0, newFollowersCount - 1);
        } else {
          // Follow: Add targetUserId to current user's following and userId to target's followers
          await Promise.all([
            Profile.findByIdAndUpdate(userProfile._id, {
              $addToSet: { following: targetUserId },
            }),
            Profile.findByIdAndUpdate(targetProfile._id, {
              $addToSet: { followers: userId },
            }),
          ]);
          newFollowingCount = newFollowingCount + 1;
          newFollowersCount = newFollowersCount + 1;
        }

        return {
          isFollowing: !isFollowing, // If it was following, now it's not, and vice versa
          followersCount: newFollowersCount,
          followingCount: newFollowingCount,
        };
      }
    );

    return Response.json({
      message: result.isFollowing
        ? "User followed successfully"
        : "User unfollowed successfully",
      status: 200,
      data: {
        isFollowing: result.isFollowing,
        followersCount: result.followersCount,
        followingCount: result.followingCount,
      },
    });
  } catch (error) {
    console.error("Error toggling follow:", error);

    // Handle duplicate key error (race condition) - though less likely with $addToSet
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return Response.json(
        {
          message:
            "Follow relationship already exists or a race condition occurred",
          status: 409,
        },
        { status: 409 }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage.includes("not found") ? 404 : 500;

    return Response.json(
      {
        message: errorMessage,
        status: statusCode,
      },
      { status: statusCode }
    );
  }
}

/**
 * @function DELETE
 * @description Handles DELETE requests to unfollow a user.
 * @param {Request} request - The incoming request object.
 * @returns {Response} A JSON response indicating the success or failure of the unfollow operation.
 */
export async function DELETE(request: Request): Promise<Response> {
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
    const { targetUserId } = body;

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return Response.json(
        { message: "Invalid or missing target user ID", status: 400 },
        { status: 400 }
      );
    }

    // Prevent a user from unfollowing themselves (though POST handles this too)
    if (userId === targetUserId) {
      return Response.json(
        { message: "Cannot unfollow yourself", status: 400 },
        { status: 400 }
      );
    }

    const unfollowResult = await runDBOperationWithTransaction(async () => {
      // Pull targetUserId from current user's following array
      const userProfileUpdate = await Profile.findOneAndUpdate(
        { user: userId },
        { $pull: { following: targetUserId } },
        { new: true } // Return the updated document
      );

      // Pull userId from target user's followers array
      const targetProfileUpdate = await Profile.findOneAndUpdate(
        { user: targetUserId },
        { $pull: { followers: userId } },
        { new: true } // Return the updated document
      );

      if (!userProfileUpdate || !targetProfileUpdate) {
        // This might indicate one of the profiles didn't exist or the relationship wasn't there
        throw new Error(
          "Follow relationship not found or profiles do not exist."
        );
      }

      // Check if the pull operations actually removed the IDs
      const wasFollowing = !userProfileUpdate.following.includes(targetUserId);
      const wasFollowed = !targetProfileUpdate.followers.includes(userId);

      if (!wasFollowing || !wasFollowed) {
        // This means the relationship wasn't there to begin with, or a partial update occurred
        throw new Error("User was not following the target user.");
      }

      return {
        message: "User unfollowed successfully",
        status: 200,
        data: {
          isFollowing: false,
          followersCount: targetProfileUpdate.followers.length,
          followingCount: userProfileUpdate.following.length,
        },
      };
    });

    return Response.json(unfollowResult.data, {
      status: unfollowResult.status,
    });
  } catch (err) {
    console.error("Error unfollowing user:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Internal server error";
    const statusCode =
      errorMessage.includes("not found") ||
      errorMessage.includes("was not following")
        ? 404
        : 500;

    return Response.json(
      {
        message: errorMessage,
        status: statusCode,
        data: err,
      },
      { status: statusCode }
    );
  }
}

/**
 * @function OPTIONS
 * @description Handles OPTIONS requests for CORS preflight.
 * @returns {Response} A response with appropriate CORS headers.
 */
export async function OPTIONS(): Promise<Response> {
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
