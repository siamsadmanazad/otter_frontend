"use client";

import { useEffect, useState, useRef } from "react";
import { Loading } from "@/components/ui/loading";
import {
  useFeedAPI,
  useUserApi,
} from "@/lib/requests";
import { useSession } from "next-auth/react";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

import { useWebsocket } from "@/lib/useWebsocket";
import {
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import ContentCreator from "../shared/content-creator-modal";
import { PostCardV2 } from "./post-card";

const NUMBER_OF_POSTS = 3;

export function PostContainer() {
  const { data: session } = useSession();
  const currentLoggedInUser = session?.user;

  const { data: currentUserProfile, isLoading: isUserLoading } = useQuery({
    queryKey: ["currentUserProfile", currentLoggedInUser?.id],
    queryFn: async () => {
      if (!currentLoggedInUser?.id) return null;
      const response = await useUserApi.getUser(currentLoggedInUser.id);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to fetch user profile.");
      }
      return response;
    },
    enabled: !!currentLoggedInUser?.id,
    staleTime: 1000 * 60 * 100,
  });

  const userImage =
    currentUserProfile?.data?.profileImage ?? currentLoggedInUser?.image;

  const [isConnected, setIsConnected] = useState(false);
  const socket = useWebsocket({
    path: "/notification",
    shouldAuthenticate: true,
    autoConnect: true,
  });

  useEffect(() => {
    if (socket) {
      socket.on("connect", () => {
        setIsConnected(true);
      });
      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      return () => {
        socket.off("connect");
        socket.off("disconnect");
      };
    }
  }, [socket]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["homeFeed"],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await useFeedAPI.getFeed(
        currentUserProfile?.data?.id,
        pageParam as number,
        NUMBER_OF_POSTS
      );
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to fetch feed.");
      }
      return response.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < NUMBER_OF_POSTS) {
        return undefined;
      }
      return allPages.length + 1;
    },
    initialPageParam: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const posts = data?.pages.flat() || [];
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading && posts.length === 0) {
    return <Loading />;
  }

  if (isError && posts.length === 0) {
    return (
      <div className="flex justify-center items-center h-48 text-red-600 dark:text-red-400">
        Error: {error?.message || "Failed to load posts."}
        <p className="ml-2">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 md:space-y-6 pb-20 md:pb-0 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {session?.user?.id ? (
        <ContentCreator profileId={session?.user?.id} userImage={userImage} />
      ) : (
        <div></div>
      )}
      {posts.length > 0
        ? posts.map((postItem) => (
            <PostCardV2
              key={postItem._id}
              post={postItem}
              session={session}
              currentUserProfile={currentUserProfile}
              userImage={userImage}
              socket={socket}
              isSocketConnected={isConnected}
            />
          ))
        : !isLoading && (
            <div className="flex justify-center items-center h-48 text-gray-600 dark:text-gray-400">
              No posts available.
            </div>
          )}
      {hasNextPage && (
        <div ref={observerTarget} className="flex justify-center mt-6 p-4">
          {isFetchingNextPage && <Loading />}{" "}
        </div>
      )}
      {!hasNextPage && posts.length > 0 && (
        <div className="flex justify-center mt-6 text-gray-500 dark:text-gray-400">
          You've reached the end of the feed. How about creating a post?
        </div>
      )}
      {isError && posts.length > 0 && (
        <div className="flex justify-center mt-6 text-red-600 dark:text-red-400">
          Error loading more posts: {error?.message || "Unknown error"}
        </div>
      )}
    </div>
  );
}

