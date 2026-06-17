"use client";

import { useFollowApi } from "@/lib/requests";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useWebsocket } from "@/lib/useWebsocket";

interface IFollowButtonProps {
  targetUserId: string;
  initialIsFollowing: boolean;
}

export const FollowButton = ({
  targetUserId,
  initialIsFollowing,
}: IFollowButtonProps) => {
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  const { data: session } = useSession();
  const currentLoggedInUserId = session?.user?.id;
  const socket = useWebsocket({
    path: "/notification",
    shouldAuthenticate: true,
    autoConnect: true,
  });

  const createNotification = async () => {
    if (socket.connected && currentLoggedInUserId && socket) {
      socket.emit("createNotification", {
        createdBy: currentLoggedInUserId,
        receiver: targetUserId,
        content: "followed you",
        type: "FOLLOW",
        isRead: false,
      });
    }
  };

  const followMutation = useMutation({
    mutationFn: async () => {
      return useFollowApi.toggleFollow(targetUserId);
    },
    onMutate: () => {
      setIsFollowing((prev) => !prev);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["suggestedUsers"] });

      if (!initialIsFollowing) {
        createNotification();
      }
    },
    onError: (err, variables, context) => {
      console.error("Error toggling follow:", err);
      setIsFollowing(initialIsFollowing);
      queryClient.invalidateQueries({ queryKey: ["suggestedUsers"] });
    },
  });

  return (
    <Button
      variant={isFollowing ? "outline" : "ghost"}
      size="sm"
      className="text-blue-500 text-xs font-semibold dark:text-blue-400 dark:hover:bg-gray-700"
      onClick={() => followMutation.mutate()}
      disabled={followMutation.isPending}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
};
