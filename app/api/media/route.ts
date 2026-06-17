import sharp from "sharp";
import {
  generateUniqueFilename,
  generateUniqueVideoFilename,
} from "@/lib/utils";
import RateLimiter_Middleware from "@/lib/rate-limiter.middleware";
import { Buffer } from "buffer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { deleteAsset, fetchImageDetails, fetchVideoDetails } from "./actions";
import { client } from "@/sanity/lib/client";
import { runDBOperation } from "@/lib/useDB";
import mediaSchema from "@/utils/schema/media-schema";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  await RateLimiter_Middleware(request);
  const isAuthenticated = await getServerSession(authOptions);
  if (!isAuthenticated?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const imageId = url.searchParams.get("id");

    if (!imageId) {
      return Response.json({ error: "Media ID is required" }, { status: 400 });
    }
    const resultForImage = await fetchImageDetails(imageId);
    const resultForVideo = await fetchVideoDetails(imageId);

    if (!resultForImage && !resultForVideo)
      return Response.json({ error: "Media not found" }, { status: 404 });

    const mediaData = resultForVideo
      ? {
          url: resultForVideo.video.asset.url,
          altText: resultForVideo.video.alt,
        }
      : {
          url: resultForImage.mainImage.asset.url,
          altText: resultForImage.mainImage.alt,
          dimensions: resultForImage.mainImage.asset.metadata.dimensions,
        };

    return Response.json({
      message: "Media retrieved successfully",
      ...mediaData
    });
  } catch (error) {
    console.log(error)
    console.error("Error retrieving image:", error);
    return Response.json(
      { error: "Failed to retrieve image" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await RateLimiter_Middleware(request);
  const isAuthenticated = await getServerSession(authOptions);
  if (!isAuthenticated?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }

    const MAX_IMAGE_SIZE_MB = 10;
    const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return Response.json(
        { error: `File size exceeds ${MAX_IMAGE_SIZE_MB}MB limit.` },
        { status: 400 }
      );
    }

    const allowedMimeTypesForImage = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
      "image/gif",
      "image/heic",
    ];
    const allowedMimeTypesForVideo = [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/mpeg",
      "video/quicktime",
      "video/x-msvideo",
    ];
    const mimeType = file.type;
    if (
      !allowedMimeTypesForImage.includes(mimeType) &&
      !allowedMimeTypesForVideo.includes(mimeType)
    ) {
      return Response.json(
        {
          error:
            "Invalid file type. Only valid images (JPEG, PNG, WebP, GIF, JPG) and videos (MP4, WebM, Ogg, MPEG, Quicktime, AVI) are allowed.",
        },
        { status: 400 }
      );
    }

    if (allowedMimeTypesForImage.includes(mimeType)) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let imageMetadata: any;
      try {
        imageMetadata = await sharp(buffer).metadata();
      } catch (error) {
        console.error("Error getting image metadata:", error);
        return Response.json(
          { error: "Uploaded file is not a valid image or is corrupted." },
          { status: 400 }
        );
      }

      const optimizedImageBuffer = await sharp(buffer)
        .webp({ quality: 70, effort: 3 })
        .toBuffer();

      const uniqueFilename = generateUniqueFilename();

      // uploading the asset and generate asset id
      const assetResponse = await client.assets.upload(
        "image",
        optimizedImageBuffer,
        {
          filename: uniqueFilename,
          contentType: "image/webp",
        }
      );

      // creating a document based on the uploaded asset id
      const docResponse = await client.create({
        _type: "images",
        mainImage: {
          _type: "image",
          asset: {
            _type: "reference",
            _ref: assetResponse._id,
          },
          alt: uniqueFilename.split(".")[0],
        },
      });

      // storing the media data
      await runDBOperation(async()=>{
        const mediaDataPayload = new mediaSchema({
          mediaType: 'IMAGE',
          documentId: docResponse._id,
          assetId: assetResponse._id,
        });
        await mediaDataPayload.save();
      })

      return Response.json({
        message: "Image uploaded, optimized, and stored in Sanity successfully",
        optimizedSize: optimizedImageBuffer.length,
        uniqueFilename,
        sanityAssetId: assetResponse._id,
        mediaId: docResponse._id,
      });
    }

    if (allowedMimeTypesForVideo.includes(mimeType)) {
      const MAX_VIDEO_SIZE_MB = 50;
      const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

      if (file.size > MAX_VIDEO_SIZE_BYTES) {
        return Response.json(
          {
            error: `Video file size exceeds the ${MAX_VIDEO_SIZE_MB}MB limit.`,
          },
          { status: 400 }
        );
      }

      // Read the file into a Buffer
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const uniqueFilename = generateUniqueVideoFilename(mimeType.split("/")[1]);

      // Upload the video and get the asset id
      const assetResponse = await client.assets.upload("file", fileBuffer, {
        filename: uniqueFilename,
        contentType: mimeType,
      });

      // Create the document referencing the video asset
      const docResponse = await client.create({
        _type: "videos",
        video: {
          _type: "file",
          asset: {
            _type: "reference",
            _ref: assetResponse._id,
          },
          alt: uniqueFilename.split(".")[0],
        },
      });

      // storing the media data
      await runDBOperation(async()=>{
        const mediaDataPayload = new mediaSchema({
          mediaType: 'VIDEO',
          documentId: docResponse._id,
          assetId: assetResponse._id,
        });
        await mediaDataPayload.save();
      })

      return Response.json({
        message: "Video uploaded and stored in Sanity successfully",
        sanityAssetId: assetResponse._id,
        mediaId: docResponse._id,
      });
    }
  } catch (error) {
    console.error("Error processing file upload:", error);
    return Response.json({ error: "Failed to process file" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  await RateLimiter_Middleware(request);
  const isAuthenticated = await getServerSession(authOptions);
  if (!isAuthenticated?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const searchParams = request.nextUrl.searchParams;
  const mediaId = searchParams.get("id");

  if (!mediaId) {
    return Response.json({ error: "Media ID is required" }, { status: 400 });
  }
  const response = await deleteAsset(mediaId);
  return Response.json(response);
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
