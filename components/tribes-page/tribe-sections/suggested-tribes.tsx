"use client";

import { useTribeAPI } from "@/lib/requests";
import { useQuery } from "@tanstack/react-query";
import { TribeCard } from "../tribe-card";
import { ITribe } from "@/types/tribes";
import { TribeCardSkeleton } from "../tribe-skeleton";

export function SuggestedTribes() {
  const {
    data: suggestedTribes,
    isLoading: loadingSuggestedTribes,
    isError: errorSuggestedTribes,
  } = useQuery({
    queryKey: ["suggested-tribes"],
    queryFn: async () => {
      const response = await useTribeAPI.getTribesForUser("notJoined");
      return response.data;
    },
  });

  if (loadingSuggestedTribes) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(6)].map((_, index) => (
          <TribeCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (errorSuggestedTribes) {
    return <div>Error loading suggested tribes.</div>;
  }

  if (!suggestedTribes || suggestedTribes.length === 0) {
    return <div>No suggested tribes found.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {suggestedTribes.map((tribe: ITribe, key: string) => (
        <TribeCard group={tribe} key={key} />
      ))}
    </div>
  );
}
