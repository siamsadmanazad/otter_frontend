import RateLimiter_Middleware from "@/lib/rate-limiter.middleware";
import { NextRequest } from "next/server";

const preflightConfig = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export const preflightRequestControl = async (request: NextRequest) => {
    request.headers.get("x-key-access-token");
    await RateLimiter_Middleware(request);
    return preflightConfig;
}