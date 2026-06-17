import { authOptions } from "@/auth";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { isMemberOfTribe, joinTribe, isCreatorOfTribe } from "../tribe.action";
import { runDBOperation } from "@/lib/useDB";

export async function GET(request: NextRequest) {
  const serverSession = await getServerSession(authOptions);
  const searchParams = request.nextUrl.searchParams;
  const requestType = searchParams.get("requestType");
  if (serverSession?.user?.id) {
    if(requestType === "memberCheck") {
      const tribeId = searchParams.get("tribeId") ?? "";
      const userId = searchParams.get("userId") ?? "";
      console.log("member check hit with tribe id", tribeId, "and user id", userId);
      const isMember = await isMemberOfTribe(tribeId, userId);
      const isAdmin = await isCreatorOfTribe(tribeId, userId);
      return Response.json({
        message: isMember ?  "Checked tribe membership" : "Failed checking tribe membership",
        status: (isMember || isAdmin) ? 200 : 400,
        data: {
          isMember,
          isAdmin,
        }
      })
    }
  }
  return Response.json({
    message: "get tribe members",
    status: 200,
    method: request.method,
  });
}

export async function POST(request: NextRequest) {
  const serverSession = await getServerSession(authOptions);
  if (serverSession?.user?.id) {
      const { tribeId, userId } = await request.json();
      const operation = await joinTribe(tribeId, userId);
      return Response.json({
        message: operation?.code ? "Failed joining tribe" : "Joined tribe",
        status: operation?.code ? 400 : 200,
        data: operation,
      });
  } else {
    return Response.json({
      message: "Unauthorized",
      status: 401,
      method: request.method,
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
