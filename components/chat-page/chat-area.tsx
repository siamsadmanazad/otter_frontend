"use client"
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Phone,
  Video,
  Info,
  Smile,
  Paperclip,
  MessageSquare,
} from "lucide-react";
import { IMessage, IUser, Group } from "@/types/chat.d";
import { Session } from "next-auth";

interface ChatAreaProps {
  selectedChatType: "private" | "group" | "global" | null;
  selectedChatId: string | null;
  currentChatMessages: IMessage[];
  session: Session | null;
  onlineUsers: IUser[];
  userGroups: Group[];
  newMessage: string;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  handleSendMessage: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  isLoggedIn: boolean;
}

export function ChatArea({
  selectedChatType,
  selectedChatId,
  currentChatMessages,
  session,
  onlineUsers,
  userGroups,
  newMessage,
  setNewMessage,
  handleSendMessage,
  messagesEndRef,
  isLoggedIn,
}: ChatAreaProps) {
  // Helper to get a user's username by ID
  const getUsernameById = (userId: string): string => {
    const user = onlineUsers.find((u) => u.id === userId);
    if (user) return user.username;
    return userId.substring(0, 8);
  };

  const getChatHeaderName = () => {
    if (selectedChatType === "global") {
      return "Global Chat";
    } else if (selectedChatType === "private" && selectedChatId) {
      const user = onlineUsers.find((u) => u.id === selectedChatId);
      return user ? user.username : "Private Chat";
    } else if (selectedChatType === "group" && selectedChatId) {
      const group = userGroups.find((g) => g.id === selectedChatId);
      return group ? group.name : "Group Chat";
    }
    return "Select a Chat";
  };

  const getChatHeaderAvatar = () => {
    if (selectedChatType === "global") {
      return <MessageSquare className="w-6 h-6 text-gray-500" />;
    } else if (selectedChatType === "private" && selectedChatId) {
      const user = onlineUsers.find((u) => u.id === selectedChatId);
      return (
        <Avatar className="w-10 h-10">
          <AvatarImage
            src={user?.avatar || "/placeholder-user.jpg"}
            alt={user?.username}
          />
          <AvatarFallback>{user?.username?.[0] || "U"}</AvatarFallback>
        </Avatar>
      );
    } else if (selectedChatType === "group" && selectedChatId) {
      const group = userGroups.find((g) => g.id === selectedChatId);
      return (
        <Avatar className="w-10 h-10">
          <AvatarImage
            src={group?.avatar || "/placeholder-group.jpg"}
            alt={group?.name}
          />
          <AvatarFallback>{group?.name?.[0] || "G"}</AvatarFallback>
        </Avatar>
      );
    }
    return null;
  };

  const getChatHeaderStatus = () => {
    if (selectedChatType === "global") {
      return "Everyone online";
    } else if (selectedChatType === "private" && selectedChatId) {
      const user = onlineUsers.find((u) => u.id === selectedChatId);
      return user?.isOnline ? "Active now" : "Offline";
    } else if (selectedChatType === "group" && selectedChatId) {
      const group = userGroups.find((g) => g.id === selectedChatId);
      return group ? `${group.members.length} members` : "";
    }
    return "";
  };

  return selectedChatId ? (
    <div
      className={`flex-1 flex flex-col bg-white md:h-[100vh] h-[88vh] ${
        !selectedChatId && "hidden"
      }`}
    >
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {getChatHeaderAvatar()}
          <div>
            <h3 className="font-semibold">{getChatHeaderName()}</h3>
            <p className="text-sm text-gray-500">{getChatHeaderStatus()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Phone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Info className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {currentChatMessages.map((message) => {
            const isCurrentUser = message.sender === session?.user?.id;
            const senderUsername = getUsernameById(message.sender);

            return (
              <div
                key={message.id}
                className={`flex ${
                  isCurrentUser ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex gap-2 max-w-xs lg:max-w-md ${
                    isCurrentUser ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar for others' messages */}
                  {!isCurrentUser && (
                    <Avatar className="w-8 h-8">
                      <AvatarImage
                        src="/placeholder.svg"
                        alt={senderUsername}
                      />
                      <AvatarFallback>
                        {senderUsername?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isCurrentUser
                        ? "bg-blue-500 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    }`}
                  >
                    {!isCurrentUser && ( // Display sender's username only for incoming messages
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {senderUsername}
                      </p>
                    )}
                    <p className="text-sm">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isCurrentUser ? "text-blue-100" : "text-gray-500"
                      }`}
                    >
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Paperclip className="w-5 h-5" />
          </Button>
          <div className="flex-1 relative">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              className="pr-10"
              disabled={!isLoggedIn || !selectedChatId}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2"
            >
              <Smile className="w-5 h-5" />
            </Button>
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isLoggedIn || !selectedChatId}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <div className="hidden md:flex flex-1 items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Send className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Your Messages</h3>
        <p className="text-gray-500">
          Send private photos and messages to a friend or group.
        </p>
      </div>
    </div>
  );
}
