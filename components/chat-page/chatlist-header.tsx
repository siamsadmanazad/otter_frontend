"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Session } from "next-auth"; // Import Session type

interface ChatListHeaderProps {
  socketStatus: string;
  isLoggedIn: boolean;
  error: string | null;
  session: Session | null;
  onCreateGroupClick: () => void;
}

export function ChatListHeader({
  socketStatus,
  isLoggedIn,
  error,
  session,
  onCreateGroupClick,
}: ChatListHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="hidden md:block p-4 border-b">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Messages</h2>
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-6 h-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCreateGroupClick}>
              Create Group
            </DropdownMenuItem>
            {/* Add other dropdown items here if needed */}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search messages"
          className="pl-10 bg-gray-100 border-0"
        />
      </div>
      <div
        className={`mt-4 text-sm font-medium ${
          socketStatus.includes("Connected") ? "text-green-600" : "text-red-600"
        }`}
      >
        {socketStatus} {isLoggedIn ? "(Logged In)" : "(Logged Out)"}
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
      {isLoggedIn &&
        session?.user?.name && ( // Changed from session?.user?.email to session?.user?.name
          <p className="text-sm text-gray-600 mt-2">
            Logged in as:{" "}
            <span className="font-semibold">{session.user.username}</span>{" "}
            {/* Changed from session.user.email to session.user.name */}
          </p>
        )}
    </div>
  );
}
