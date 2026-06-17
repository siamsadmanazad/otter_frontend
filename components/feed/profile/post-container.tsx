"use client";

import { useEffect, useState, useRef } from "react";
import { Loading } from "@/components/ui/loading";
import { useFeedAPI } from "@/lib/requests";
import { useSession } from "next-auth/react";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

import {
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useWebsocket } from "@/lib/useWebsocket";
import { PostCard } from "./post-card";

const POSTS_PER_PAGE = 3;

export function PostContainer({ profileId }: { profileId: string }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
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
  const observerRef = useRef<HTMLDivElement | null>(null);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["ProfileFeed", profileId],
    queryFn: async ({ pageParam = 1 }) => {
      const result = await useFeedAPI.getFeedForProfile(
        pageParam,
        POSTS_PER_PAGE,
        profileId
      );
      if (result.status === 500) {
        throw new Error(`HTTP error! status: ${result.status}`);
      }
      if (result.status === 200 && result.data) {
        return result.data;
      } else {
        throw new Error(`API error: ${result.message || "Unknown error"}`);
      }
    },
    getNextPageParam: (lastPage, allPages) => {
      const hasMoreData = lastPage.length === POSTS_PER_PAGE;
      return hasMoreData ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const posts = data?.pages?.flatMap((page) => page) || [];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
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
      {posts.length > 0
        ? posts.map((postItem) => (
            <PostCard key={postItem._id} post={postItem} session={session} socket={socket} isSocketConnected={isConnected}/>
          ))
        : !isLoading &&
          !isError && (
            <div className="flex justify-center items-center h-48 text-gray-600 dark:text-gray-400">
              No posts available.
            </div>
          )}

      {(hasNextPage || isFetchingNextPage) && (
        <div ref={observerRef} className="flex justify-center py-4">
          {isFetchingNextPage && <Loading />}
        </div>
      )}

      {!hasNextPage && posts.length > 0 && !isFetchingNextPage && (
        <div className="flex justify-center py-4 text-gray-500 dark:text-gray-400">
          You've reached the end of the posts.
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
