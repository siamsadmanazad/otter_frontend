import { NextRequest } from "next/server";
import { GetAnalytics } from "./analytics.action";

export async function GET(request: NextRequest) {
  const result = await GetAnalytics();
  return Response.json(result);
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
