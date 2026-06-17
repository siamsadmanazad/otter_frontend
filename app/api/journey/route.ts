import { authOptions } from "@/auth";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const serverSession = await getServerSession(authOptions);
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get("id");
  if (serverSession?.user?.id) {
    // do something
  }
  return Response.json({
    message: "get journals",
    status: 200,
    method: request.method,
  });
}

export async function POST(request: Request) {
  return Response.json({
    message: "create journals",
    status: 200,
    method: request.method,
  });
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
