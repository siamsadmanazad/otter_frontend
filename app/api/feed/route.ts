import { NextRequest, NextResponse } from "next/server";
import { getPublicFeed, getPublicFeed_v2 } from "./feed.action";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get("id");
  const versionId = searchParams.get("versionId");

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const skip = (page - 1) * limit;

  try {

    ////////////////////////////////////////////////////////////////////////
    /* v2 testing, requires profileId and versionId to be set */
    if(versionId === "v2") {
      try {
        const dummy = await getPublicFeed_v2(skip, limit, profileId ?? "");
        console.log(dummy, "dummy");
      } catch(err) {
        console.log(err, "the heck");
      }
      const posts = {}
      const totalPosts = {}
      return NextResponse.json({
        message: "Received v2 feed data",
        status: 200,
        data: posts,
        pagination: {
          currentPage: page,
          postsPerPage: limit,
          totalPosts: totalPosts,
          totalPages: 10, /* Math.ceil(totalPosts / limit) */
          hasMore: true, /* page * limit < totalPosts */
        },
      });
    }
    ////////////////////////////////////////////////////////////////////////

    const { posts, totalPosts } = await getPublicFeed(skip, limit);

    return NextResponse.json({
      message: "Received feed data",
      status: 200,
      data: posts,
      pagination: {
        currentPage: page,
        postsPerPage: limit,
        totalPosts: totalPosts,
        totalPages: Math.ceil(totalPosts / limit),
        hasMore: page * limit < totalPosts,
      },
    });
  } catch (err) {
    console.error("Error fetching posts:", err);
    return NextResponse.json({
      message: `Failed to load posts: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
      status: 500,
      data: [],
      pagination: {
        currentPage: 1,
        postsPerPage: limit,
        totalPosts: 0,
        totalPages: 0,
        hasMore: false,
      },
    });
  }
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
