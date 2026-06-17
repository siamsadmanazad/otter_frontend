import { runDBOperation } from "@/lib/useDB";
import { client } from "@/sanity/lib/client";
import mediaSchema from "@/utils/schema/media-schema";

export async function fetchImageDetails(imageId: string) {
  const imageQuery = `*[_type == "images" && _id == $imageId]{
    mainImage {
      asset->{
        url,
        metadata {
          dimensions {
            width,
            height
          }
        }
      },
      alt
    }
}[0]`;

  return await client.fetch(imageQuery, { imageId });
}

export async function fetchVideoDetails(videoId: string) {
  const videoQuery = `*[_type == "videos" && _id == $videoId]{
    video {
      asset->{
        url
      },
      alt
    }
}[0]`;

  return await client.fetch(videoQuery, { videoId });
}

export async function deleteAsset(mediaId: string) {
  try {
    const mediaData = await mediaSchema.findOne({ serial: mediaId });
    if (!mediaData) {
      return Response.json({ error: "Media not found" }, { status: 404 });
    }
    const sanityDocumentId = mediaData.documentId;
    const sanityAssetId = mediaData.assetId;

    // delete the document from sanity
    await client.delete(sanityDocumentId);

    // delete the asset from sanity
    await client.delete(sanityAssetId)

    // delete the document from the database
    await runDBOperation(async()=>{
      await mediaSchema.deleteOne({ mediaId });
    })
    return { message: "Media deleted successfully", status: 200 };
  } catch (error) {
    console.error("Error deleting media:", error);
    return { message: "Failed to delete media", status: 500 };
  }
}