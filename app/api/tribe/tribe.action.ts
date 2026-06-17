import { z } from "zod";
import tribesSchema from "@/utils/schema/tribes-schema";

import { ITribePlain } from "@/types/tribes.d";
import { runDBOperation, runDBOperationWithTransaction } from "@/lib/useDB";
import { Types } from "mongoose";
import profileSchema from "@/utils/schema/profile-schema";
import postsSchema from "@/utils/schema/posts-schema";

export const TribeCategorySchema = z.enum([
  "JOURNEY",
  "LOCATION",
  "COMMUNITY",
  "FOOD",
  "BIKERS",
  "CYCLISTS",
  "LONG_TRAVEL",
  "ABROAD",
]);

export const TribePrivacySchema = z.enum(["PUBLIC", "PRIVATE"]);

export const TribeValidationSchema = z.object({
  description: z
    .string()
    .max(4096, "Description must be less than 4096 characters")
    .optional(),
  category: TribeCategorySchema.default("COMMUNITY"),
  tags: z.array(z.string()).default([]),
  coverImage: z.string().optional(),
  profileImage: z.string().optional(),
  name: z
    .string()
    .min(2, "Group name must be at least 2 characters")
    .max(50, "Group name must be less than 50 characters"),
  users: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).default([]),
  posts: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).default([]),
  createdBy: z.string().regex(/^[0-9a-fA-F]{24}$/),
  privacy: TribePrivacySchema.default("PUBLIC"),
});

export async function createTribeAction(data: ITribePlain) {
  try {
    const tribe = TribeValidationSchema.parse(data);
    const tribePayload = await runDBOperation(async () => {
      const tribeLoad = new tribesSchema(tribe);
      await tribeLoad.save();
      return tribeLoad;
    });
    return tribePayload;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getTribe(id: string) {
  try {
    const tribe = await runDBOperation(async () => {
      const data = await tribesSchema.findById(id).lean().exec();
      return data;
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getTribeBySerial(serial: string) {
  try {
    // WIP -> createdBy is not fetched properly, fix the aggregation pipeline
    const tribe = await runDBOperation(async () => {
      const data = await tribesSchema
        .aggregate([
          {
            $match: { serial },
          },
          {
            $lookup: {
              from: "profiles",
              localField: "createdBy",
              foreignField: "_id",
              as: "createdBy",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    profileImage: 1,
                  },
                },
              ],
            },
          },
          {
            $project: {
              name: "$name",
              serial: "$serial",
              description: "$description",
              category: "$category",
              tags: "$tags",
              coverImage: "$coverImage",
              profileImage: "$profileImage",
              createdBy: {
                _id: "$createdBy._id",
                username: "$createdBy.username",
                profileImage: "$createdBy.profileImage",
              },
              privacy: "$privacy",
              createdAt: "$createdAt",
              updatedAt: "$updatedAt",
              usersCount: {
                $size: "$users",
              },
              postsCount: {
                $size: "$posts",
              },
            },
          },
        ])
        .exec();
      return data[0];
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getTribes(page: string, limit: string) {
  try {
    const _page = parseInt(page) - 1;
    const _limit = parseInt(limit);
    const tribe = await runDBOperation(async () => {
      return await tribesSchema
        .find()
        .limit(_limit)
        .skip(_page * _limit)
        .select("-posts -users")
        .lean()
        .exec();
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getJoinedTribes(userId: string, page: string, limit: string) {
  try {
    const _page = parseInt(page) - 1;
    const _limit = parseInt(limit);
    const tribe = await runDBOperation(async () => {
      return await tribesSchema
        .find({ users: { $in: [userId] } })
        .limit(_limit)
        .skip(_page * _limit)
        .select("-posts -users")
        .lean()
        .exec();
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getCreatedTribes(
  userId: string,
  page: string,
  limit: string
) {
  try {
    const _page = parseInt(page) - 1;
    const _limit = parseInt(limit);
    const tribe = await runDBOperation(async () => {
      return await tribesSchema
        .find({ createdBy: userId })
        .limit(_limit)
        .skip(_page * _limit)
        .select("-posts -users")
        .lean()
        .exec();
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getUnjoinedTribes(
  userId: string,
  page: string,
  limit: string
) {
  try {
    const _page = parseInt(page) - 1;
    const _limit = parseInt(limit);
    const tribe = await runDBOperation(async () => {
      return await tribesSchema
        .find({ users: { $nin: [userId] } })
        .limit(_limit)
        .skip(_page * _limit)
        .select("-posts -users")
        .lean()
        .exec();
    }
    );
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getTribesByCategory(
  category: string,
  page: string,
  limit: string
) {
  try {
    const _page = parseInt(page);
    const _limit = parseInt(limit);
    const tribe = await runDBOperation(async () => {
      return await tribesSchema
        .find({ category })
        .limit(_limit)
        .skip(_page * _limit)
        .select("-posts -users")
        .lean()
        .exec();
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getTribesByTag(tag: string, page: string, limit: string) {
  try {
    const _page = parseInt(page);
    const _limit = parseInt(limit);
    const tribe = await runDBOperation(async () => {
      return await tribesSchema
        .find({ tags: { $in: [tag] } })
        .limit(_limit)
        .skip(_page * _limit)
        .select("-posts -users")
        .lean()
        .exec();
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getTribePosts(id: string, page: string, limit: string) {
  try {
    const _page = parseInt(page);
    const _limit = parseInt(limit);
    const tribe = await runDBOperation(async () => {
      // return await tribesSchema
      //   .findById(id)
      //   .populate({
      //     path: "posts",
      //     options: {
      //       skip: _page * _limit,
      //       limit: _limit,
      //     },
      //   })
      //   .select("-users")
      //   .lean()
      //   .exec();
      return await postsSchema.find({ fromGroup: id }).populate([
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
      ]).lean().exec();
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getTribeMembers(id: string, page: string, limit: string) {
  try {
    const _page = parseInt(page);
    const _limit = parseInt(limit);
    const tribe = await runDBOperation(async () => {
      return await tribesSchema
        .findById(id)
        .populate({
          path: "users",
        })
        .skip(_page * _limit)
        .limit(_limit)
        .lean()
        .exec();
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function getUsersTribe(id: string, page: string, limit: string) {
  // gets tribes created by users and member of
  try {
    const _page = parseInt(page);
    const _limit = parseInt(limit);
    const tribe = await runDBOperation(async () => {
      return await tribesSchema
        .find({ $or: [{ createdBy: id }, { users: { $in: [id] } }] })
        .limit(_limit)
        .skip(_page * _limit)
        .select("-posts -users")
        .lean()
        .exec();
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function updateTribe(id: string, data: ITribePlain) {
  try {
    const tribe = await runDBOperation(async () => {
      return await tribesSchema.findOneAndUpdate({serial: id}, data, { new: true });
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function deleteTribeAction(id: string) {
  try {
    const tribe = await runDBOperation(async () => {
      return await tribesSchema.findOneAndDelete({ serial: id })
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function joinTribe(id: string, userId: string) {
  try {
    const result = await runDBOperationWithTransaction(async () => {
      const userIdObj = new Types.ObjectId(userId);
      const tribeIdObj = new Types.ObjectId(id);

      // Validation of required IDs
      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid ID format of tribe or user id");
      }

      try {
        const tribe = await tribesSchema.findById(id).select("users").exec();

        if (!tribe) {
          throw new Error("Tribe not found");
        }

        const usersArray = Array.isArray(tribe.users) ? tribe.users : [];
        const isMember = usersArray
          .map((id: Types.ObjectId) => id.toString())
          .includes(userIdObj.toString());

        let action: "joined" | "left" = isMember ? "left" : "joined";

        // Update tribe — remove or add user
        await tribesSchema
          .findOneAndUpdate(
            { _id: tribeIdObj },
            isMember
              ? { $pull: { users: userIdObj } }
              : { $addToSet: { users: userIdObj } },
            { new: true }
          )
          .exec();

        // Update profile — remove or add tribe
        await profileSchema
          .findOneAndUpdate(
            { user: userIdObj },
            isMember
              ? { $pull: { tribes: tribeIdObj } }
              : { $addToSet: { tribes: tribeIdObj } },
            { new: true, upsert: false }
          )
          .exec();

        // Fetch updated tribe to return
        const updatedTribe = await tribesSchema
          .findById(tribeIdObj)
          .populate("users")
          .exec();

        if (!updatedTribe) {
          throw new Error("Failed to retrieve updated tribe");
        }

        return { tribe: updatedTribe, action };
      } catch (error) {
        throw error;
      }
    });

    return {
      tribe: result.tribe,
      action: result.action,
    };
  } catch (error) {
    console.error("Join tribe failed", error);
    if (error instanceof Error) {
      return { message: error.message, code: 500 };
    }
    return {
      message: "Unknown error occurred on joining tribe, Error:14404",
      code: 500,
    };
  }
}

export async function isMemberOfTribe(tribeId: string, userId: string) {
  try {
    const tribe = await runDBOperation(async () => {
      const tribeData = await tribesSchema
        .findOne({serial: tribeId})
        .select("users")
        .lean()
        .exec();
      const parsedTribeData = JSON.stringify(tribeData);
      const _parsedTribeData = JSON.parse(parsedTribeData);
      return _parsedTribeData?.users ? _parsedTribeData.users.includes(userId) : false;
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}

export async function isCreatorOfTribe(tribeId: string, userId: string) {
  try {
    const tribe = await runDBOperation(async () => {
      const tribeData = await tribesSchema
        .findOne({serial: tribeId})
        .select("createdBy")
        .lean()
        .exec();
      const parsedTribeData = JSON.stringify(tribeData);
      const _parsedTribeData = JSON.parse(parsedTribeData);
      return _parsedTribeData?.createdBy === userId ? true : false;
    });
    return tribe;
  } catch (error) {
    const errResponse = error as unknown as { message: string; code: number };
    return errResponse;
  }
}
