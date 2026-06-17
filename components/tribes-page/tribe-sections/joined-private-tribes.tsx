"use client";

import { useTribeAPI } from "@/lib/requests";
import { useQuery } from "@tanstack/react-query";
import { TribeCard } from "../tribe-card";
import { ITribe } from "@/types/tribes";
import { TribeCardSkeleton } from "../tribe-skeleton";

export function JoinedPrivateTribes() {
  const {
    data: joinedTribes,
    isLoading: loadingJoinedTribes,
    isError: errorJoinedTribes,
  } = useQuery({
    queryKey: ["joined-tribes"],
    queryFn: async () => {
      const response = await useTribeAPI.getTribesForUser("joined");
      return response.data;
    },
  });

  if (loadingJoinedTribes) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(6)].map((_, index) => (
          <TribeCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (errorJoinedTribes) {
    return <div>Error loading joined tribes</div>;
  }

  if (!joinedTribes || joinedTribes.length === 0) {
    return <div>No joined tribes found.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {joinedTribes.map((tribe: ITribe, index: number) => (
        <TribeCard group={tribe} key={index} />
      ))}
    </div>
  );
}
