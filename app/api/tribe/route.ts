import { authOptions } from "@/auth";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import {
  createTribeAction,
  deleteTribeAction,
  getCreatedTribes,
  getJoinedTribes,
  getTribe,
  getTribeBySerial,
  getTribeMembers,
  getTribePosts,
  getTribes,
  getUnjoinedTribes,
  getUsersTribe,
  updateTribe,
} from "./tribe.action";

export async function GET(request: NextRequest) {
  const serverSession = await getServerSession(authOptions);
  const searchParams = request.nextUrl.searchParams;

  const tribeId = searchParams.get("id") ?? "";
  const tribeSerial = searchParams.get("serial") ?? "";
  const page = searchParams.get("page") ?? "";
  const limit = searchParams.get("limit") ?? "";
  const userId = searchParams.get("user") ?? "";
  const member = searchParams.get("member") ?? "";
  const posts = searchParams.get("posts") ?? "";

  const ownership = searchParams.get("ownership") ?? "";
  // should be joined or created or notJoined
  if (serverSession?.user?.id) {
    let payload: any;
    if (
      member === "true" &&
      tribeId &&
      tribeId.length > 1 &&
      page &&
      limit &&
      page.length > 0 &&
      limit.length > 0
    ) {
      console.log("case reached for members");
      payload = await getTribeMembers(tribeId, page, limit);
    } else if (
      posts === "true" &&
      tribeId &&
      tribeId.length > 1 &&
      page &&
      limit &&
      page.length > 0 &&
      limit.length > 0
    ) {
      console.log("case reached for posts");
      payload = await getTribePosts(tribeId, page, limit);
    } else if (ownership && ownership.length > 0) {
      console.log("case reached for membership/ownership");
      if(ownership === "joined") {
        payload = await getJoinedTribes(serverSession?.user?.id, page, limit);
      } else if(ownership === "created") {
        payload = await getCreatedTribes(serverSession?.user?.id, page, limit);
      } else {
        payload = await getUnjoinedTribes(serverSession?.user?.id, page, limit);
      }
    } else if (page && limit && page.length > 0 && limit.length > 0) {
      console.log("case reached for page and limit");
      payload = await getTribes(page, limit);
    } else if (tribeId && tribeId.length > 1) {
      console.log("case reached for tribe id");
      payload = await getTribe(tribeId);
    } else if (userId && userId.length > 1) {
      console.log("case reached for user created and joined tribes");
      payload = await getUsersTribe(userId, page, limit);
    } else if (tribeSerial && tribeSerial.length > 1) {
      console.log("case reached for user created and joined tribes");
      payload = await getTribeBySerial(tribeSerial);
    } else {
      payload = [];
    }
    return Response.json({
      message: "Get tribes",
      status: 200,
      data: payload,
    });
  }
  return Response.json({
    message: "Unauthorized",
    status: 401,
    method: request.method,
  });
}

export async function POST(request: NextRequest) {
  const serverSession = await getServerSession(authOptions);
  if (serverSession?.user?.id) {
    const body = await request.json();
    const createPayload = await createTribeAction(body);
    return Response.json({
      message: createPayload._id ? "Created tribe" : "Failed to create tribe",
      status: 200,
      data: createPayload,
    });
  } else {
    return Response.json({
      message: "Unauthorized",
      status: 401,
      method: request.method,
    });
  }
}

export async function PATCH(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const serverSession = await getServerSession(authOptions);

  if (serverSession?.user?.id) {
    const tribeId = searchParams.get("serial") ?? "";
    const payload = await request.json();
    const operation = await updateTribe(tribeId, payload);
    return Response.json({
      message: operation?.code ? "Failed updating tribe" : "Tribe updated",
      status: operation?.code ? 400 : 200,
      data: operation,
    });
  } else {
    return Response.json({
      message: "Unauthorized",
      status: 401,
    });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tribeId = searchParams.get("id") ?? "";
  const serverSession = await getServerSession(authOptions);

  if (serverSession?.user?.id) {
    const operation = await deleteTribeAction(tribeId);
    return Response.json({
      message: operation?.code ? "Failed deleting tribe" : "Deleted Tribe",
      status: operation?.code ? 400 : 200,
      data: operation,
    });
  } else {
    return Response.json({
      message: "Unauthorized",
      status: 401,
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
