"use client";

import React, { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatListHeader } from "./chatlist-header";
import type { Conversation } from "@/types/chat.d";

interface ChatListProps {
  conversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  onSelect: (conv: Conversation) => void;
  onNewChat: () => void;
}

function convTitle(conv: Conversation): string {
  if (conv.type === "GROUP") return conv.name || "Group";
  return conv.otherUser?.fullName || conv.otherUser?.username || "Conversation";
}

function preview(conv: Conversation): string {
  if (!conv.lastMessage) return "Start the conversation";
  if (conv.lastMessage.deleted) return "Message deleted";
  return conv.lastMessage.content || "Sent an attachment";
}

export function ChatList({
  conversations,
  activeId,
  isLoading,
  onSelect,
  onNewChat,
}: ChatListProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return convTitle(c).toLowerCase().includes(q);
  });

  return (
    <div
      className={`${
        activeId && "hidden md:block"
      } w-full md:w-80 bg-white border-r flex flex-col`}
    >
      <ChatListHeader onNewChat={onNewChat} search={search} setSearch={setSearch} />

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="p-4 text-sm text-gray-500 text-center">
              Loading conversations…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">
              No conversations yet. Tap the compose icon to start one.
            </div>
          ) : (
            filtered.map((conv) => {
              const title = convTitle(conv);
              const avatar =
                conv.type === "GROUP"
                  ? conv.coverImage
                  : conv.otherUser?.profileImage;
              const time = conv.lastMessage
                ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <div
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${
                    activeId === conv.id ? "bg-blue-50 border border-blue-200" : ""
                  }`}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={avatar || "/placeholder.svg"} alt={title} />
                    <AvatarFallback>{title[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3
                        className={`text-sm truncate ${
                          conv.unread ? "font-bold" : "font-semibold"
                        }`}
                      >
                        {title}
                      </h3>
                      <span className="text-xs text-gray-500">{time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm truncate ${
                          conv.unread ? "text-gray-900 font-medium" : "text-gray-600"
                        }`}
                      >
                        {preview(conv)}
                      </p>
                      {conv.unread && (
                        <span className="ml-2 w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
