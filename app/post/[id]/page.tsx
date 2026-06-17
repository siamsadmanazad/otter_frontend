import { Metadata } from "next";

import GetPost from "./action";
import PostPage from "./_component";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const { id } = await params;
  let title = "Photo";

  try {
    const postData = await GetPost(id);
    if (postData && postData.caption) {
      const words = postData.caption.split(/\s+/).filter(Boolean);
      title = words.slice(0, 5).join(" ");
    }
  } catch (error) {
    console.error("Failed to fetch post data for metadata:", error);
  }
  return {
    title: title,
  };
}

export default async function Page({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  try {
    const postData = await GetPost(id);
    if (postData) {
      return (
        <PostPage postData={postData} />
      );
    } else {
      return (
        <div>
          <h1>Post not found</h1>
        </div>
      );
    }
  } catch (error) {
    console.error("Error fetching post data in Page component:", error);
    return (
      <div>
        <h1>Error loading post</h1>
      </div>
    );
  }
}
