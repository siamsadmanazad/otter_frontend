import axios from "axios";

type TImageResponse = { data: { imageUrl: string } };

export async function getSanityImage(key: string): Promise<TImageResponse> {
  try {
    const imageLink = await axios.get<string, TImageResponse>(
      `/api/media?id=${key}`,
    );
    return imageLink;
  } catch (err: unknown) {
    const errorMessage = err as { message: string };
    console.log(`Failed to get image payload because: ${errorMessage}`);
    const fallback = "https://picsum.photos/id/237/200/300";
    return {
      data: {
        imageUrl: fallback,
      },
    };
  }
}


interface IMediaResponse {
  data: {
    url: string;
    altText: string;
    dimensions?: {
      height: number;
      width: number;
    }
  }
}

export async function getSanityMedia(key: string): Promise<IMediaResponse> {
  try {
    const mediaLink = await axios.get<string, IMediaResponse>(
      `/api/media?id=${key}`
    );
    console.log(mediaLink.data);
    return mediaLink;
  } catch (err: unknown) {
    const errorMessage = err as { message: string };
    console.log(`Failed to get image payload because: ${errorMessage}`);
    const fallback = "https://picsum.photos/id/237/200/300";
    return {
      data: {
        url: fallback,
        altText: "Fallback image",
      }
    };
  }
}