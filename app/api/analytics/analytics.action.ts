"use server";

import { runDBOperation } from "@/lib/useDB";
import commentsSchema from "@/utils/schema/comments-schema";
import likeSchema from "@/utils/schema/like-schema";
import postsSchema from "@/utils/schema/posts-schema";
import userSchema from "@/utils/schema/user-schema";

interface IAnalayticsSuccessProps {
    status: 200 | 500;
    data: {
        yearly: {
            postsThisYear: number;
            commentsThisYear: number;
            likesThisYear: number;
            usersJoinedThisYear: number;
        };
        monthly: {
            month: string;
            posts: number;
            comments: number;
            likes: number;
            usersJoined: number;
        }[];
    } | {};
} 

export async function GetAnalytics(): Promise<IAnalayticsSuccessProps> {
  // Get the current year
  const currentYear = new Date().getFullYear();

  // Define start and end dates for the entire year
  const startOfYear = new Date(currentYear, 0, 1); // January 1st of the current year
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59); // December 31st of the current year

  try {
    const operation = await runDBOperation(async () => {
      // --- Yearly Analytics ---

      // Count posts created this year
      const postsThisYear = await postsSchema.countDocuments({
        createdAt: { $gte: startOfYear, $lte: endOfYear },
      });

      // Count comments created this year
      const commentsThisYear = await commentsSchema.countDocuments({
        createdAt: { $gte: startOfYear, $lte: endOfYear },
      });

      // Count likes created this year
      const likesThisYear = await likeSchema.countDocuments({
        createdAt: { $gte: startOfYear, $lte: endOfYear },
      });

      // Count users joined this year
      const usersJoinedThisYear = await userSchema.countDocuments({
        createdAt: { $gte: startOfYear, $lte: endOfYear },
      });

      // --- Monthly Analytics ---
      const monthlyData = [];
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      for (let i = 0; i < 12; i++) {
        const startOfMonth = new Date(currentYear, i, 1);
        // Get the last day of the current month
        const endOfMonth = new Date(currentYear, i + 1, 0, 23, 59, 59); // Day 0 of next month is last day of current month

        // Count posts for the current month
        const postsThisMonth = await postsSchema.countDocuments({
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        });

        // Count comments for the current month
        const commentsThisMonth = await commentsSchema.countDocuments({
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        });

        // Count likes for the current month
        const likesThisMonth = await likeSchema.countDocuments({
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        });

        // Count users joined for the current month
        const usersJoinedThisMonth = await userSchema.countDocuments({
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        });

        monthlyData.push({
          month: monthNames[i],
          posts: postsThisMonth,
          comments: commentsThisMonth,
          likes: likesThisMonth,
          usersJoined: usersJoinedThisMonth,
        });
      }

      return {
        yearly: {
          postsThisYear,
          commentsThisYear,
          likesThisYear,
          usersJoinedThisYear,
        },
        monthly: monthlyData,
      };
    });

    // required: average size of media uploads (This would require a separate 'Media' schema
    // that stores information about uploads, including their size. If you have one,
    // you would query it similarly to the other schemas.)

    return {
      status: 200,
      data: operation, // 'operation' now contains both yearly and monthly data
    };
  } catch (err) {
    console.error("Error retrieving analytics:", err); // Use console.error for errors
    return {
     status: 500,
     data: {} 
    };
  }
}