import { authOptions } from "@/auth";
import RateLimiter_Middleware from "@/lib/rate-limiter.middleware";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import {
  createComment,
  deleteComment,
  getComments,
  updateComment,
} from "./comment.action";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const postId = searchParams.get("postId") ?? "";
  const response = await getComments(postId);
  return Response.json(response);
}

export async function POST(request: Request) {
  await RateLimiter_Middleware(request);
  try {
    const userData = await getServerSession(authOptions);
    if (!userData) {
      return Response.json({
        message: "Unauthorized",
        status: 401,
        data: {},
      });
    }
    const postBody = await request.json();
    const response = await createComment(postBody);
    return Response.json(response);
  } catch (err) {
    console.log("error at endpoint", JSON.stringify(err));
    return Response.json({
      message: "Error posting comment",
      status: 500,
      data: err,
    });
  }
}

export async function DELETE(request: NextRequest) {
  const userData = await getServerSession(authOptions);
  if (!userData) {
    return Response.json({
      message: "Unauthorized",
      status: 401,
      data: {},
    });
  }
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id") ?? "";

  const deletedComment = await deleteComment(id);
  return Response.json(deletedComment);
}

export async function PATCH(request: Request) {
  const userData = await getServerSession(authOptions);
  if (!userData) {
    return Response.json({
      message: "Unauthorized",
      status: 401,
      data: {},
    });
  }
  const postBody = await request.json();
  const updatedComment = await updateComment(postBody);
  return Response.json(updatedComment);
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
