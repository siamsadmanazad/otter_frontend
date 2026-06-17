"use server";

import { runDBOperation, runDBOperationWithTransaction } from "@/lib/useDB";
import postsSchema from "@/utils/schema/posts-schema";
import profileSchema from "@/utils/schema/profile-schema";

import "@/utils/schema/comments-schema";
import "@/utils/schema/like-schema";
import "@/utils/schema/tribes-schema";
import { ObjectId } from "mongoose";

export async function getPublicFeed(
  skip: number,
  limit: number,
  profileId?: string
) {
  const { posts, totalPosts } = await runDBOperationWithTransaction(
    async () => {
      const query = postsSchema.find().where("fromGroup", { $exists: false });
      const totalCount = await postsSchema.countDocuments(query.getQuery());
      const fetchedPosts = await query
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          {
            path: "owner",
            select: "_id fullName username profileImage",
          },
          {
            path: "likes",
            model: "User",
            select: "_id username fullName profileImage",
          },
          {
            path: "comments",
            model: "Comment",
            select: "_id content owner createdAt",
            populate: {
              path: "owner",
              model: "User",
              select: "_id username profileImage",
            },
          },
          {
            path: "fromGroup",
            model: "Tribe",
            select: "_id name serial",
          },
        ])
        .lean();

      return { posts: fetchedPosts, totalPosts: totalCount };
    }
  );
  return { posts, totalPosts };
}

function testLogger(scope: string, message: string, payloads: any) {
  console.log(
    `at scope: ${scope}, logging for: ${message}, payloads recieved: ${JSON.stringify(
      payloads
    )}`
  );
}

/*
 WIP: This is a new function that is not yet implemented
 This function often fails to work if the array for joinedTribes or createdTribes is empty, appearently creating a new profile solves this issue.
 or the old user interacts with new feature, it works
 TODO: fix this
 - fetch the profile
 - filter following, tribesJoined, tribesCreated
 - get the IDs
 - fetch all the posts that were created by the following, tribesJoined, tribesCreated
 - populate them according to creation date
 - return the posts
*/

interface IUserProfile {
  _id: ObjectId;
  following: ObjectId[];
  tribesJoined: ObjectId[];
  tribesCreated: ObjectId[];
}

export async function getPublicFeed_v2(
  skip: number,
  limit: number,
  profileId?: string
) {
  testLogger("getPublicFeed_v2", "start", { skip, limit, profileId });

  if (!profileId) {
    return { posts: [], totalPosts: 0 };
  }

  return await runDBOperation(async () => {
    let profile: IUserProfile | null = null;
    try {
      profile = await profileSchema
        .findOne({ user: profileId })
        .select("following tribesJoined tribesCreated")
        .lean();
    } catch (error) {
      testLogger("getPublicFeed_v2", "fetch profile error", error);
      return { posts: [], totalPosts: 0 };
    }

    if (!profile) {
      return { posts: [], totalPosts: 0 };
    }

    // Conditionally build the query conditions array
    const queryConditions = [];

    // Add condition for 'following' if the array is not empty
    if (profile.following?.length) {
      const followingIds = profile.following.map((id: any) => id.toString());
      queryConditions.push({ owner: { $in: followingIds } });
    }

    // Add condition for 'tribes' if either joined or created arrays are not empty
    const joinedTribes = profile.tribesJoined || [];
    const createdTribes = profile.tribesCreated || [];
    const tribeIds = [...new Set([...joinedTribes, ...createdTribes])].map(
      (id: any) => id.toString()
    );

    if (tribeIds.length) {
      queryConditions.push({ fromGroup: { $in: tribeIds } });
    }

    // Handle the edge case where no query conditions exist
    if (!queryConditions.length) {
      return { posts: [], totalPosts: 0 };
    }

    testLogger("getPublicFeed_v2", "query conditions", queryConditions);

    const baseQuery = postsSchema.find({ $or: queryConditions });
    const totalCount = await postsSchema.countDocuments(baseQuery.getQuery());

    const fetchedPosts = await baseQuery
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        { path: "owner", select: "_id fullName username profileImage" },
        {
          path: "likes",
          model: "User",
          select: "_id username fullName profileImage",
        },
        {
          path: "comments",
          model: "Comment",
          select: "_id content owner createdAt",
          populate: {
            path: "owner",
            model: "User",
            select: "_id username profileImage",
          },
        },
        { path: "fromGroup", model: "Tribe", select: "_id name serial" },
      ])
      .lean();

    return { posts: fetchedPosts, totalPosts: totalCount };
  });
}
