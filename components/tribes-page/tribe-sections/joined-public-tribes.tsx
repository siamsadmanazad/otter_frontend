"use client";

import { useTribeAPI } from "@/lib/requests";
import { useQuery } from "@tanstack/react-query";
import { TribeCard } from "../tribe-card";
import { ITribe } from "@/types/tribes";
import { TribeCardSkeleton } from "../tribe-skeleton";

export function JoinedPublicTribes() {
  const {
    data: joinedPublicTribes,
    isLoading: loadingJoinedPublicTribes,
    isError: errorJoinedPublicTribes,
  } = useQuery({
    queryKey: ["created-tribes"],
    queryFn: async () => {
      const response = await useTribeAPI.getTribesForUser("joined");
      console.log(response.data);
      return response.data;
    },
  });
  if (errorJoinedPublicTribes)
    return <div>Error loading joined public tribes</div>;
  if (loadingJoinedPublicTribes)
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(6)].map((_, index) => (
          <TribeCardSkeleton key={index} />
        ))}
      </div>
    );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {joinedPublicTribes?.map((tribe: ITribe, index: number) => (
        <TribeCard group={tribe} key={index} />
      ))}
    </div>
  );
}
