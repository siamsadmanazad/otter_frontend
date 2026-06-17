"use server";

import { runDBOperation } from "@/lib/useDB";
import postsSchema from "@/utils/schema/posts-schema";
import userSchema from "@/utils/schema/user-schema";

interface IFilterProps {
  profileFilter?: string | null;
  groupFilter?: string | null;
  shopFilter?: string | null;
  hashtags?: string | null;
  page: number;
  limit: number;
}
interface ISearchResult {
  users?: any[];
  shops?: any[];
  hashtags?: any[];
}
export async function getSearchData(filters: IFilterProps) {
  try {
    const operation = await runDBOperation(async () => {
      let searchResults: ISearchResult = {};
      const skip = (filters.page - 1) * filters.limit;
      if (filters.groupFilter) {
        // not implemented yet
        // searchResults = await userSchema.find({
        //     group: { $regex: filters.groupFilter, $options: 'i' }
        // })
        //           .skip(skip)
        // .limit(filters.limit);
      }
      if (filters.profileFilter) {
        searchResults.users = await userSchema
          .find({
            fullName: { $regex: filters.profileFilter, $options: "i" },
            active: true,
          })
          .select("-password -emails -agreeToTerms -reputation -bio -socials")
          .skip(skip)
          .limit(filters.limit);
      }
      if (filters.shopFilter) {
        // not implemented yet
        // searchResults.shops = await userSchema.find({
        //     shop: { $regex: filters.shopFilter, $options: 'i' },
        // })
        //           .skip(skip)
        // .limit(filters.limit);
        searchResults.shops = []; // remove after implementation
      }
      if (filters.hashtags) {
        searchResults.hashtags = await postsSchema
          .find({
            hashtags: { $regex: filters.hashtags, $options: "i" },
          })
          .skip(skip)
          .limit(filters.limit);
      }
      return searchResults;
    });
    return operation;
  } catch (err) {
    console.log(err);
    return {
      users: [],
      shops: [],
      hashtags: [],
    };
  }
}
