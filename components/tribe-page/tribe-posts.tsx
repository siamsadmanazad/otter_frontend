"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Share,
  MoreHorizontal,
  Heart,
  MapPin,
  Loader2,
} from "lucide-react";
import { Loading } from "../ui/loading";
import { useCommentApi, useLikeApi, useTribeAPI, useUserApi } from "@/lib/requests";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useWebsocket } from "@/lib/useWebsocket";
import { IPostProps } from "@/types/post";
import { toast } from "sonner";
import { Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { TribePostCard } from "./tribe-post-card-test";

dayjs.extend(relativeTime);

export function TribePosts({ tribeId }: { tribeId: string }) {
  const loadMoreRef = useRef(null);
  const { data: session } = useSession();

  const fetchPosts = async ({ pageParam = 1 }) => {
    const response = await useTribeAPI.getTribePosts(tribeId, pageParam, 10);
    return response.data;
  };

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["tribeFeed", tribeId],
    queryFn: fetchPosts,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 10) {
        return undefined;
      }
      return allPages.length + 1;
    },
  });

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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 1.0 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (status === "pending") return <Loading />;
  if (status === "error") return <span>Error: {error.message}</span>;

  const allPosts = data?.pages.flatMap((page) => page) || [];
  console.log(data)

  return (
    <div className="space-y-6">
      {allPosts.map((post, index: number) => {
        return (
          <TribePostCard
          key={index}
          post={post}
          currentUserProfile={currentUserProfile}
          session={session}
          userImage={userImage}
          socket={socket}
          isSocketConnected={isConnected}
          />
        );
      })}

      <div ref={loadMoreRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!hasNextPage && (
        <p className="text-center text-gray-500 dark:text-gray-400">
          You've reached the end!
        </p>
      )}
    </div>
  );
}

