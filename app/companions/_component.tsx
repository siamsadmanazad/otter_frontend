"use client";

import { useCompanionAPI } from "@/lib/requests";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, AlertTriangle } from "lucide-react";
import { FollowButton } from "@/components/follow-button";
import Link from "next/link";

const NUMBER_OF_PROFILES = 10;

export default function CompanionPage() {
  const { data: session } = useSession();

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
      const response = await useCompanionAPI.getCompanions(
        session?.user?.id as string,
        pageParam as number,
        NUMBER_OF_PROFILES
      );
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to fetch feed.");
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
    enabled: !!session?.user?.id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-4 dark:text-gray-300">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex justify-center items-center h-full p-4 text-red-500 dark:text-red-400">
        <AlertTriangle className="h-6 w-6 mr-2" />
        <p>Error: {error.message}</p>
      </div>
    );
  }

  const allSuggestedUsers = data?.pages.flatMap((page) => page) ?? [];

  return (
    <div className="flex flex-col p-4 md:mx-20 mx-auto bg-gray-50 dark:bg-gray-900 dark:text-gray-50">
      <h2 className="font-bold text-2xl mb-4">Companions Around You</h2>
      <div className="flex flex-col space-y-4">
        {allSuggestedUsers.length > 0 ? (
          allSuggestedUsers.map((profile) => (
            <Card
              key={profile._id}
              className="flex flex-col max-w-[625px] max-h-[325px] dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
            >
              <CardHeader className="flex flex-row items-center space-x-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={profile.user?.profileImage} />
                  <AvatarFallback>
                    {profile.user?.fullName?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/person/${profile.user?._id}`}
                      className="text-black hover:text-blue-500 duration-300 dark:text-white dark:hover:text-blue-400"
                    >
                      {profile.user?.fullName}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    <Link
                      href={`/person/${profile.user?._id}`}
                      className="text-blue-500 hover:text-blue-300 duration-300 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      @{profile.user?.username}
                    </Link>
                  </CardDescription>
                </div>
                <FollowButton
                  targetUserId={profile.user._id}
                  initialIsFollowing={false}
                />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 line-clamp-2 dark:text-gray-400">
                  {profile.user?.bio || profile.user?.location}
                </p>
              </CardContent>
              <CardFooter className="flex justify-end"></CardFooter>
            </Card>
          ))
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400">No suggested users found.</p>
        )}
      </div>
      {hasNextPage && (
        <div className="mt-8 text-center">
          <Button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2"
          >
            {isFetchingNextPage ? "Loading more..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
