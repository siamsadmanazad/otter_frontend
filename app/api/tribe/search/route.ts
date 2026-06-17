import { authOptions } from "@/auth";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { isMemberOfTribe, joinTribe } from "../tribe.action";
import { runDBOperation } from "@/lib/useDB";
import tribesSchema from "@/utils/schema/tribes-schema";
import RateLimiter_Middleware from "@/lib/rate-limiter.middleware";

export interface IPayloadProps {
  privacy?: string;
  category?: string | null;
  tags?: string[];
}

function searchFilter(payload: IPayloadProps) {
  let searchPayload: { [key: string]: any } = {
    privacy: payload.privacy ?? null,
    category: payload.category ?? null,
    tags: payload.tags ?? null,
  }
  Object.keys(searchPayload).forEach(key => {
    if (searchPayload[key] === null) {
      delete searchPayload[key];
    }
    if(searchPayload.tags) {
      if(searchPayload.tags.length === 0){
        delete searchPayload['tags'];
      }
    }
    if(searchPayload.category === null || searchPayload.category === 'NONE' || searchPayload.category === '') {
      delete searchPayload['category'];
    }
  });
  return searchPayload;
}


export async function GET(request: NextRequest) {
  const serverSession = await getServerSession(authOptions);
  const searchParams = request.nextUrl.searchParams;
  //const requestType = searchParams.get("requestType");
  const searchText = searchParams.get("searchText");
  const payload = await request.json();
  const searchPayload = searchFilter(payload);

  // if (serverSession?.user?.id) {
    const operation = await runDBOperation(async()=>{
      const searchAndFilterTribes = 
      await tribesSchema.find( 
        {
          ...searchPayload, 
          name: { $regex: searchText, $options: 'i' } 
        } );
      return searchAndFilterTribes;
    })
    return Response.json({
      message: "get searched tribes",
      status: 200,
      data: operation,
    })
  //}

  // return Response.json({
  //   message: "get tribe members",
  //   status: 200,
  //   method: request.method,
  // });
}

export async function POST(request: NextRequest) {
  await RateLimiter_Middleware(request);
  const serverSession = await getServerSession(authOptions);
  const searchParams = request.nextUrl.searchParams;
  //const requestType = searchParams.get("requestType");
  const searchText = searchParams.get("searchText");
  const payload = await request.json();
  const searchPayload = searchFilter(payload);

  // if (serverSession?.user?.id) {
    const operation = await runDBOperation(async()=>{
      console.log(searchPayload, searchText);
      const searchAndFilterTribes = 
      await tribesSchema.find( 
        {
          ...searchPayload, 
          name: { $regex: searchText, $options: 'i' } 
        })
        .select("-users -posts -updatedAt")
        .lean()
        .exec();
      return searchAndFilterTribes;
    })
    return Response.json({
      message: "get searched tribes",
      status: 200,
      data: operation,
    })
  // }

  // return Response.json({
  //   message: "unauthorized error",
  //   status: 200,
  //   method: request.method,
  // });
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
