import { NextRequest } from "next/server";
import { getSuggestionData } from "./action";

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const profileFilter = searchParams.get("profile") ?? null;
  const groupFilter = searchParams.get("group") ?? null;
  const shopFilter = searchParams.get("shop") ?? null;
  const hashtags = searchParams.get("hashtags") ?? null;

  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "10", 10);

  const user: { userId?: string } = await request.json();

  const data = await getSuggestionData({
    filters: {
      profileFilter,
      groupFilter,
      shopFilter,
      hashtags,
      page,
      limit,
      userId: user.userId ?? "",
    },
  });

  return Response.json({
    message: "Hello World",
    status: 200,
    data,
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
