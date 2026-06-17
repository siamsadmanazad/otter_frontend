import { NextRequest } from "next/server";
import { getSearchData } from "./action";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const profileFilter = searchParams.get("profile") ?? null;
  const groupFilter = searchParams.get("group") ?? null;
  const shopFilter = searchParams.get("shop") ?? null;
  const hashtags = searchParams.get("hashtags") ?? null;

  const page = parseInt(searchParams.get("page") ?? "1", 10) ?? null;
  const limit = parseInt(searchParams.get("limit") ?? "10") ?? null;

  const searchResult = await getSearchData({
    profileFilter,
    groupFilter,
    shopFilter,
    hashtags,
    page,
    limit,
  });
  return Response.json({
    message: "Fetched search results",
    status: 200,
    method: request.method,
    data: searchResult,
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
