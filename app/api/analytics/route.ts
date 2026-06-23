import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureRouteError } from "@/lib/observability";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// GET /api/analytics -> { status, data: { yearly, monthly[] } }  (Chart.js dashboard)
export async function GET() {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1).toISOString();
  const end = new Date(year, 11, 31, 23, 59, 59).toISOString();

  try {
    const db = createAdminClient();
    const fetchMonths = async (table: string) => {
      const { data } = await db
        .from(table)
        .select("created_at")
        .gte("created_at", start)
        .lte("created_at", end);
      return ((data ?? []) as { created_at: string }[]).map((r) => new Date(r.created_at).getMonth());
    };

    const [posts, comments, likes, users] = await Promise.all([
      fetchMonths("posts"),
      fetchMonths("comments"),
      fetchMonths("likes"),
      fetchMonths("profiles"),
    ]);

    const bucket = (months: number[]) => {
      const b = new Array(12).fill(0);
      months.forEach((m) => (b[m] += 1));
      return b;
    };
    const pB = bucket(posts), cB = bucket(comments), lB = bucket(likes), uB = bucket(users);

    const monthly = MONTHS.map((month, i) => ({
      month,
      posts: pB[i],
      comments: cB[i],
      likes: lB[i],
      usersJoined: uB[i],
    }));

    return NextResponse.json({
      status: 200,
      data: {
        yearly: {
          postsThisYear: posts.length,
          commentsThisYear: comments.length,
          likesThisYear: likes.length,
          usersJoinedThisYear: users.length,
        },
        monthly,
      },
    });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    captureRouteError("analytics load failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: 500, data: {} });
  }
}
