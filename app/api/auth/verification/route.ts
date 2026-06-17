import { NextRequest } from "next/server";
import * as jwt from "jsonwebtoken";
import { runDBOperation } from "@/lib/useDB";
import userSchema from "@/utils/schema/user-schema";
import axios from "axios";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("id");
  if (!token) {
    return new Response("Provide your token please", { status: 400 });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as unknown as { email: string;  iat: number; exp: number };
    const verificationData = await axios.get(
      `${process.env.PULSE_BASE_URL}api/verification/${token}`
    );
    if (verificationData.data.data) { 
      const getUserData = await runDBOperation(async () => {
        const user = await userSchema
          .findOne({ email: decoded?.email ?? "" })
          .select("email fullName serial profileImage location")
          .lean()
          .exec();
        return user;
      });
        if (getUserData) {
          return Response.json({
            message: "user retrieved",
            status: 200,
            data: getUserData,
          });
        } else {
          return Response.json({
            message: "user not retrieved",
            status: 400,
            data: null,
          });
        }
    } else {
      return Response.json({
        message: "user not verified",
        status: 400,
        data: null,
      });
    }
  } catch (err) {
    console.log(err)
    return Response.json({
      message: "user not verified",
      status: 400,
      data: null,
    })
  }
}

export async function POST(request: Request) {
  return Response.json({
    message: "Hello World",
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
