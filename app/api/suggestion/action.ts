"use server";

import { runDBOperation } from "@/lib/useDB";
import userSchema from "@/utils/schema/user-schema";

interface IFilterProps {
  profileFilter?: string | null;
  groupFilter?: string | null;
  shopFilter?: string | null;
  hashtags?: string | null;
  page: number;
  limit: number;
  userId: string;
}

interface ISuggestionResult {
  users?: any[];
  shops?: any[];
  hashtags?: any[];
  posts?: any[];
}

export async function getSuggestionData({
  filters,
}: {
  filters: IFilterProps;
}): Promise<ISuggestionResult> {
  try {
    const operation = await runDBOperation(async () => {
      const suggestionResult: ISuggestionResult = {};

      const skip = (filters.page - 1) * filters.limit;
      const userProfile = await userSchema
        .findOne({ _id: filters.userId });
      if (filters.profileFilter) {
        suggestionResult.users = await userSchema
          .find({
            location: { $regex: userProfile?.location, $options: "i" },
            createdAt: {
              $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60), // 60 days = ~2 months
            },
          })
          .sort({ createdAt: -1 }) // latest to oldest
          .skip(skip)
          .limit(filters.limit);
      }

      return suggestionResult;
    });

    return operation;
  } catch (err) {
    return {
      users: [],
      shops: [],
      hashtags: [],
      posts: [],
    };
  }
}
