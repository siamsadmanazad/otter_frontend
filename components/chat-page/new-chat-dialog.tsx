"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useFollowApi } from "@/lib/requests";
import type { ChatUser } from "@/types/chat.d";

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  onSelectUser: (userId: string) => void;
}

export function NewChatDialog({
  isOpen,
  onClose,
  currentUserId,
  onSelectUser,
}: NewChatDialogProps) {
  const [search, setSearch] = useState("");

  const { data: people = [], isLoading } = useQuery({
    queryKey: ["chat", "following", currentUserId],
    queryFn: async () => {
      const res: any = await useFollowApi.getFollowersOrFollowing(
        currentUserId as string,
        "following"
      );
      return (res?.data ?? []) as ChatUser[];
    },
    enabled: isOpen && !!currentUserId,
  });

  const filtered = people.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Start a conversation with someone you follow.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ScrollArea className="h-72 mt-2">
          {isLoading ? (
            <div className="p-4 text-sm text-gray-500 text-center">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">
              {people.length === 0
                ? "Follow people to start chatting with them."
                : "No matches."}
            </div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  onSelectUser(u.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 text-left"
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={u.profileImage || "/placeholder.svg"} alt={u.fullName} />
                  <AvatarFallback>{u.fullName?.[0] ?? "U"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{u.fullName}</p>
                  <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
