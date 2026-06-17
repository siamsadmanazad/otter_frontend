"use client";

import { useQuery } from "@tanstack/react-query";
import { TribeCard } from "../tribe-card";
import { useTribeAPI } from "@/lib/requests";
import { ITribe } from "@/types/tribes";
import { TribeCardSkeleton } from "../tribe-skeleton";

export function CreatedTribes() {
  const {
    data: createdTribes,
    isLoading: loadingCreatedTribes,
    isError: errorCreatedTribes,
  } = useQuery({
    queryKey: ["created-tribes"],
    queryFn: async () => {
      const response = await useTribeAPI.getTribesForUser("created");
      return response.data;
    },
  });

  if (loadingCreatedTribes) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(6)].map((_, index) => (
          <TribeCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (errorCreatedTribes) {
    return <div>Error loading created tribes</div>;
  }

  if (!createdTribes || createdTribes.length === 0) {
    return <div>No created tribes found.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {createdTribes.map((tribe: ITribe, index: number) => (
        <TribeCard key={index} group={tribe} />
      ))}
    </div>
  );
}
