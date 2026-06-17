"use client";

import { useTribeAPI } from "@/lib/requests";
import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export function JoinedTribes() {
  const {data: session} = useSession();
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
    queryKey: ["joinedTribes"],
    queryFn: async ({ pageParam = 1 }) => {
      const response = useTribeAPI.getJoinedTribes(userId);
      return response;
    },
    getNextPageParam: (lastPage, allPages) => {
      return 1;
      // if (lastPage.length < NUMBER_OF_PROFILES) {
      //   return undefined;
      // }
      // return allPages.length + 1;
    },
    initialPageParam: 1,
    staleTime: 1000 * 60 * 5,
    enabled: !!userId,
  });
  console.log(data, "from joined tribes");
  return <></>;
}