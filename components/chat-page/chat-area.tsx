"use client";
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, Info } from "lucide-react";
import type { Conversation, ChatMessage } from "@/types/chat.d";

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  currentUserId: string | null;
  isLoadingMessages: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  newMessage: string;
  setNewMessage: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onBack: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

function title(conv: Conversation): string {
  if (conv.type === "GROUP") return conv.name || "Group";
  return conv.otherUser?.fullName || conv.otherUser?.username || "Conversation";
}

export function ChatArea({
  conversation,
  messages,
  currentUserId,
  isLoadingMessages,
  hasMore,
  onLoadMore,
  newMessage,
  setNewMessage,
  onSend,
  sending,
  onBack,
  messagesEndRef,
}: ChatAreaProps) {
  if (!conversation) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Your Messages</h3>
          <p className="text-gray-500">
            Send private messages to a friend or companion.
          </p>
        </div>
      </div>
    );
  }

  const headerName = title(conversation);
  const headerAvatar =
    conversation.type === "GROUP"
      ? conversation.coverImage
      : conversation.otherUser?.profileImage;

  return (
    <div className="flex-1 flex flex-col bg-white md:h-[100vh] h-[88vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Avatar className="w-10 h-10">
            <AvatarImage src={headerAvatar || "/placeholder.svg"} alt={headerName} />
            <AvatarFallback>{headerName[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{headerName}</h3>
            {conversation.otherUser?.username && (
              <p className="text-sm text-gray-500">
                @{conversation.otherUser.username}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <Info className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={onLoadMore}>
                Load older messages
              </Button>
            </div>
          )}
          {isLoadingMessages && messages.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-6">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-6">
              No messages yet. Say hello!
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.senderId === currentUserId;
              const name =
                message.sender?.fullName || message.sender?.username || "User";
              return (
                <div
                  key={message.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex gap-2 max-w-xs lg:max-w-md ${
                      isMine ? "flex-row-reverse" : ""
                    }`}
                  >
                    {!isMine && (
                      <Avatar className="w-8 h-8">
                        <AvatarImage
                          src={message.sender?.profileImage || "/placeholder.svg"}
                          alt={name}
                        />
                        <AvatarFallback>{name[0]}</AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isMine
                          ? "bg-blue-500 text-white rounded-br-md"
                          : "bg-gray-100 text-gray-900 rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.deleted ? (
                          <span className="italic opacity-70">
                            Message deleted
                          </span>
                        ) : (
                          message.content
                        )}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          isMine ? "text-blue-100" : "text-gray-500"
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
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            onClick={onSend}
            disabled={!newMessage.trim() || sending}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
