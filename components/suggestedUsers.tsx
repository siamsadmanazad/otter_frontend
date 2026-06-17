"use client";

import { useCompanionAPI } from "@/lib/requests";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
import { FollowButton } from "./follow-button";
import Link from "next/link";
import { Card } from "./ui/card";
import { FeedFooter } from "./feed-footer";

const NUMBER_OF_PROFILES = 5;

export function SuggestedUsers() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["suggestedUsers"],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await useCompanionAPI.getCompanions(
        userId as string,
        pageParam as number,
        NUMBER_OF_PROFILES
      );
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to fetch suggested users.");
      }
      return response.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < NUMBER_OF_PROFILES) {
        return undefined;
      }
      return allPages.length + 1;
    },
    initialPageParam: 1,
    staleTime: 1000 * 60 * 5,
    enabled: !!userId,
  });

  const observerTarget = useRef(null);

  useEffect(() => {
    if (isLoading || isFetchingNextPage || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 1.0 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col justify-center items-center p-4 text-red-500">
        <AlertTriangle className="h-6 w-6 mr-2" />
        <p>Error: {error.message}</p>
      </div>
    );
  }

  const allSuggestedUsers = data?.pages.flatMap((page) => page) ?? [];

  return (
    <div className="flex flex-col space-y-4 p-4 sticky top-4">
      {allSuggestedUsers.length > 0 ? (
        allSuggestedUsers.map((profile) => (
          <div key={profile._id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage
                  src={profile.user?.profileImage || "/placeholder.svg"}
                />
                <AvatarFallback className="dark:bg-gray-700 dark:text-gray-300">
                  {profile.user?.username?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <Link
                  href={`/person/${profile.user._id}`}
                  className="font-semibold text-sm text-gray-900 dark:text-gray-100 hover:text-blue-500 duration-300"
                >
                  {profile.user?.username}
                </Link>
                <Link
                  href={`/person/${profile.user._id}`}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 duration-300"
                >
                  {profile.user?.fullName}
                </Link>
              </div>
            </div>
            <FollowButton
              targetUserId={profile.user._id}
              initialIsFollowing={false}
            />
          </div>
        ))
      ) : (
        <p className="text-center text-gray-500">No suggested users found.</p>
      )}

      {isFetchingNextPage && (
        <div className="flex justify-center items-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      )}

      <div ref={observerTarget} />
    </div>
  );
}
export function SuggestedUserWrapper() {
  return (
    <div className="hidden lg:block w-80 space-y-6 sticky top-8">
      <Card className="p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-500 dark:text-gray-300">
            Suggested for you
          </h3>
          <Link
            href="/companions"
            className="text-xs font-semibold text-gray-700 dark:text-gray-200 dark:hover:bg-gray-700 hover:underline"
          >
            See All
          </Link>
        </div>
        <SuggestedUsers />
      </Card>

      <FeedFooter />
    </div>
  );
}
