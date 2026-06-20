"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, PenSquare } from "lucide-react";

interface ChatListHeaderProps {
  onNewChat: () => void;
  search: string;
  setSearch: (v: string) => void;
}

export function ChatListHeader({
  onNewChat,
  search,
  setSearch,
}: ChatListHeaderProps) {
  return (
    <div className="hidden md:block p-4 border-b">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Messages</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          aria-label="New message"
        >
          <PenSquare className="w-5 h-5" />
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search messages"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-gray-100 border-0"
        />
      </div>
    </div>
  );
}
