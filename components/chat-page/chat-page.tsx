"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MessageSquare, Send } from "lucide-react";
import { useSession } from "next-auth/react";

// Import the new custom hook and components
import { useChatLogic } from "./useChatLogic";
import { ChatList } from "./chat-list";
import { ChatArea } from "./chat-area";
import { CreateGroupDialog } from "./create-group-dialog";

import type { IDisplayConversation, IMessage, IUser } from "@/types/chat.d";

export function ChatPage() {
  const { data: session, status } = useSession();

  const [selectedChatType, setSelectedChatType] = useState<
    "private" | "group" | "global" | "user" | null 
  >(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);

  const {
    socket,
    isLoggedIn,
    socketStatus,
    error,
    onlineUsers,
    userGroups,
    globalMessages,
    privateMessages,
    groupMessages,
    unreadCounts,
    messagesEndRef,
    handleSendMessage,
    handleSelectChat: handleSelectChatFromHook,
    emitCreateGroup,
  } = useChatLogic({
    selectedChatType,
    selectedChatId,
    setNewMessage,
    newMessage,
  });

  const handleSelectChat = useCallback(
    (conv: IDisplayConversation) => {
      console.log("Selected chat (conv object):", conv);
      setSelectedChatType(conv.type as "private" | "group" | "global" | "user");
      setSelectedChatId(conv.id);
      handleSelectChatFromHook(conv);
    },
    [handleSelectChatFromHook]
  );

  const currentChatMessages = useMemo(() => {
    const currentUserId = session?.user?.id
      ? String(session.user.id)
      : undefined;

    if (selectedChatType === "global") {
      console.log("  Returning global messages.");
      console.log("--- Filtering messages END ---");
      return globalMessages;
    } else if (
      selectedChatType === "user" &&
      selectedChatId &&
      currentUserId
    ) {
      const filtered = privateMessages.filter((msg) => {
        const msgSender = String(msg.sender);
        const msgReceiver = msg.receiver ? String(msg.receiver) : undefined;

        const condition1 =
          msgSender === currentUserId && msgReceiver === selectedChatId;
        const condition2 =
          msgSender === selectedChatId && msgReceiver === currentUserId;
        return condition1 || condition2;
      });
      console.log("  Filtered private messages count:", filtered.length);
      console.log("--- Filtering messages END ---");
      return filtered;
    } else if (selectedChatType === "group" && selectedChatId) {
      console.log("  Returning group messages.");
      console.log("--- Filtering messages END ---");
      return groupMessages[selectedChatId] || [];
    }
    console.log("  No chat selected or invalid type. Returning empty array.");
    console.log("--- Filtering messages END ---");
    return [];
  }, [
    selectedChatType,
    selectedChatId,
    globalMessages,
    privateMessages,
    groupMessages,
    session?.user?.id, // Keep session.user.id in dependencies
  ]);

  // Prepare conversations for display in the left panel
  const displayConversations: IDisplayConversation[] = useMemo(() => {
    const conversationsMap = new Map<string, IDisplayConversation>();

    // Add Global Chat option
    conversationsMap.set("global-chat", {
      id: "global-chat",
      type: "global",
      name: "Global Chat",
      online: true,
      lastMessage:
        globalMessages.length > 0
          ? globalMessages[globalMessages.length - 1].content
          : "Start chatting globally!",
      timestamp:
        globalMessages.length > 0
          ? new Date(
              globalMessages[globalMessages.length - 1].createdAt
            ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "",
      unread: unreadCounts.get("global-chat") || 0,
    });

    // Add Online Users
    onlineUsers.forEach((user) => {
      // Ensure user.id from onlineUsers is stringified for consistency
      const userIdString = String(user.id);
      if (userIdString !== String(session?.user?.id)) {
        // Compare stringified IDs
        conversationsMap.set(`user-${userIdString}`, {
          id: userIdString, // Use the stringified ID
          type: "user",
          name: user.username,
          online: user.isOnline,
          avatar: `/placeholder-user.jpg`,
          lastMessage: "",
          timestamp: "",
          unread: unreadCounts.get(userIdString) || 0,
        });
      }
    });

    // Add User Groups
    userGroups.forEach((group) => {
      conversationsMap.set(`group-${group.id}`, {
        id: group.id,
        type: "group",
        name: group.name,
        online: true,
        avatar: `/placeholder-group.jpg`,
        lastMessage:
          groupMessages[group.id]?.length > 0
            ? groupMessages[group.id][groupMessages[group.id].length - 1]
                .content
            : "No messages yet.",
        timestamp:
          groupMessages[group.id]?.length > 0
            ? new Date(
                groupMessages[group.id][
                  groupMessages[group.id].length - 1
                ].createdAt
              ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "",
        unread: unreadCounts.get(group.id) || 0,
      });
    });

    // Update last message and timestamp for private chats
    privateMessages.forEach((msg) => {
      const currentUserId = session?.user?.id
        ? String(session.user.id)
        : undefined;
      const msgSender = String(msg.sender);
      const msgReceiver = msg.receiver ? String(msg.receiver) : undefined;

      let otherUserId = null;
      if (currentUserId && msgSender === currentUserId && msgReceiver) {
        otherUserId = msgReceiver;
      } else if (currentUserId && msgReceiver === currentUserId && msgSender) {
        otherUserId = msgSender;
      }

      if (otherUserId && conversationsMap.has(`user-${otherUserId}`)) {
        const conv = conversationsMap.get(`user-${otherUserId}`);
        if (
          !conv!.timestamp ||
          new Date(msg.createdAt) > new Date(conv!.timestamp)
        ) {
          conversationsMap.set(`user-${otherUserId}`, {
            ...conv!,
            lastMessage: msg.content,
            timestamp: new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        }
      }
    });

    return Array.from(conversationsMap.values()).sort((a, b) => {
      if (a.type === "global") return -1;
      if (b.type === "global") return 1;

      if (a.type === "user" && b.type === "group") return -1;
      if (a.type === "group" && b.type === "user") return 1;

      if (a.type === "user" && b.type === "user") {
        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;
        return a.name.localeCompare(b.name);
      }

      return a.name.localeCompare(b.name);
    });
  }, [
    onlineUsers,
    userGroups,
    globalMessages,
    groupMessages,
    privateMessages,
    session?.user?.id,
    unreadCounts,
  ]);

  const handleCreateGroupClick = useCallback(() => {
    setIsCreateGroupDialogOpen(true);
  }, []);

  const handleCloseCreateGroupDialog = useCallback(() => {
    setIsCreateGroupDialogOpen(false);
  }, []);

  return (
    <div className="bg-gray-50 h-screen flex flex-col">
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Messages</h1>
          <span
            className={`text-xs font-medium ml-auto ${
              socketStatus.includes("Connected")
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {socketStatus.split(" ")[0]}{" "}
            {isLoggedIn ? "(Logged In)" : "(Logged Out)"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat List - Left Panel */}
        <ChatList
          selectedChatId={selectedChatId}
          selectedChatType={selectedChatType}
          displayConversations={displayConversations}
          handleSelectChat={handleSelectChat}
          socketStatus={socketStatus}
          isLoggedIn={isLoggedIn}
          error={error}
          session={session}
          onCreateGroupClick={handleCreateGroupClick}
        />

        {/* Chat Area - Right Panel */}
        {selectedChatId ? (
          <ChatArea
            selectedChatType={selectedChatType}
            selectedChatId={selectedChatId}
            currentChatMessages={currentChatMessages}
            session={session}
            onlineUsers={onlineUsers}
            userGroups={userGroups}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            handleSendMessage={handleSendMessage}
            messagesEndRef={messagesEndRef}
            isLoggedIn={isLoggedIn}
          />
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
        )}
      </div>

      {/* Create Group Dialog */}
      <CreateGroupDialog
        isOpen={isCreateGroupDialogOpen}
        onClose={handleCloseCreateGroupDialog}
        onlineUsers={onlineUsers}
        onCreateGroup={emitCreateGroup}
        currentUserId={session?.user?.id}
      />
    </div>
  );
}
