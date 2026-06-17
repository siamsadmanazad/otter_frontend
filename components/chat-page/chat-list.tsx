"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Users } from "lucide-react";
import { IDisplayConversation } from "@/types/chat.d";
import { ChatListHeader } from "./chatlist-header";
import { Session } from "next-auth";

interface ChatListProps {
  selectedChatId: string | null;
  selectedChatType: "private" | "group" | "global" | null;
  displayConversations: IDisplayConversation[];
  handleSelectChat: (conv: IDisplayConversation) => void;
  socketStatus: string;
  isLoggedIn: boolean;
  error: string | null;
  session: Session | null;
  onCreateGroupClick: () => void;
}

export function ChatList({
  selectedChatId,
  selectedChatType,
  displayConversations,
  handleSelectChat,
  socketStatus,
  isLoggedIn,
  error,
  session,
  onCreateGroupClick,
}: ChatListProps) {
  return (
    <div
      className={`${
        selectedChatId && "hidden md:block"
      } w-full md:w-80 bg-white border-r flex flex-col`}
    >
      {/* Desktop Header */}
      <ChatListHeader
        socketStatus={socketStatus}
        isLoggedIn={isLoggedIn}
        error={error}
        session={session}
        onCreateGroupClick={onCreateGroupClick}
      />

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {displayConversations.map((conv) => (
            <div
              key={conv.type === "global" ? conv.id : `${conv.type}-${conv.id}`}
              onClick={() => handleSelectChat(conv)}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${
                (selectedChatId === conv.id &&
                  selectedChatType === conv.type) ||
                (conv.type === "global" &&
                  selectedChatId === "global-chat" &&
                  selectedChatType === "global")
                  ? "bg-blue-50 border border-blue-200"
                  : ""
              }`}
            >
              <div className="relative">
                {conv.type === "global" ? (
                  <MessageSquare className="w-12 h-12 text-gray-500 p-2 rounded-full bg-gray-100" />
                ) : conv.type === "group" ? (
                  <Users className="w-12 h-12 text-gray-500 p-2 rounded-full bg-gray-100" />
                ) : (
                  <Avatar className="w-12 h-12">
                    <AvatarImage
                      src={conv.avatar || "/placeholder.svg"}
                      alt={conv.name}
                    />
                    <AvatarFallback>{conv.name[0]}</AvatarFallback>
                  </Avatar>
                )}
                {conv.online && conv.type === "user" && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3
                    className={`font-semibold text-sm truncate ${
                      conv?.unread > 0 ? "font-bold" : ""
                    }`}
                  >
                    {conv.name}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {conv.timestamp}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate">
                    {conv.lastMessage}
                  </p>
                  {conv.unread > 0 && (
                    <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
