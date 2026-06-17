import { NextRequest } from "next/server";
import { getAllReviews, getReviewById } from "./actions";
import { runDBOperation } from "@/lib/useDB";
import reviewSchema from "@/utils/schema/review-schema";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reviewId = searchParams.get("id") ?? "";

  if (!reviewId) {
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "10");
    const data = await getAllReviews({ page, limit });
    return Response.json({
      message: "Recieved data",
      status: 200,
      data,
    });
  } else {
    const data = await getReviewById(reviewId);
    return Response.json({
      message: "Recieved data",
      status: 200,
      data,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.type === "REVIEW") {
      const data = await runDBOperation(async () => {
        const reviewBody = new reviewSchema(body);
        return await reviewBody.save();
      });
      return Response.json({
        message: "review submitted",
        status: 200,
        data,
      });
    } else {
      const data = await runDBOperation(async () => {
        const reviewBody = new reviewSchema(body);
        return await reviewBody.save();
      });
      return Response.json({
        message: "bug report submitted",
        status: 200,
        data,
      });
    }
  } catch (err) {
    const errResponse = err as unknown as { message: string; status: number };
    return Response.json({
      message: errResponse.message,
      status: errResponse.status,
    });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const profileId = searchParams.get("id");
    const requestBody = await request.json();
    const updateReview = await runDBOperation(async () => {
      const response = await reviewSchema.findByIdAndUpdate(
        profileId,
        requestBody,
        { new: true }
      );
      return response;
    });
    return Response.json({
      message: "Review updated",
      status: 200,
      data: updateReview,
    });
  } catch (err) {
    const errResponse = err as unknown as { message: string; status: number };
    return Response.json({
      message: errResponse.message,
      status: errResponse.status,
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reviewId = searchParams.get("id");
    const deleteReview = await runDBOperation(async () => {
      const response = await reviewSchema.findByIdAndDelete(reviewId);
      return response;
    });
    return Response.json({
      message: "Review deleted",
      status: 200,
      data: deleteReview,
    });
  } catch (err) {
    const errResponse = err as unknown as { message: string; status: number };
    return Response.json({
      message: errResponse.message,
      status: errResponse.status,
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
