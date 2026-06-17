import { runDBOperation } from "@/lib/useDB";
import profileSchema from "@/utils/schema/profile-schema";
import { NextRequest } from "next/server";

import "@/utils/schema/user-schema";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const skip = (page - 1) * limit;

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const suggestedUsers = await runDBOperation(async () => {
    const currentUserProfile = await profileSchema.findOne({ user: userId }).select('following').lean().exec();

    if (!currentUserProfile) {
      return [];
    }
    const followingIds = currentUserProfile.following.map((id:string) => id.toString());
    const suggestedUsersData = await profileSchema
      .find({
        user: {
          $nin: [...followingIds, userId],
        },
      })
      .populate({
        path: "user",
        select: "_id fullName username bio location role profileImage",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("user _id createdAt updatedAt")
      .lean()
      .exec();

    return suggestedUsersData;
  });

  return Response.json({
    message: "Hello World",
    status: 200,
    data: suggestedUsers,
  });
}

export async function POST(request: NextRequest) {
  return Response.json({
    message: "Hello World",
    status: 200,
    method: request.method,
  });
}

export async function OPTIONS(request: NextRequest) {
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
