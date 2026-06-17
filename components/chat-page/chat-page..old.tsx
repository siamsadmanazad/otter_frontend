"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Send,
  Phone,
  Video,
  Info,
  Search,
  MoreHorizontal,
  Smile,
  Paperclip,
  Users,
  MessageSquare,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useWebsocket } from "@/lib/useWebsocket";
import type { IDisplayConversation, IMessage, IUser } from "@/types/chat.d";

export function ChatPage() {
  const { data: session, status } = useSession();
  const socket = useWebsocket({
    path: "/chat",
    shouldAuthenticate: true,
    autoConnect: true,
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [socketStatus, setSocketStatus] = useState("Connecting...");
  const [error, setError] = useState<string | null>(null);

  // Chat data states
  const [onlineUsers, setOnlineUsers] = useState<IUser[]>([]);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [globalMessages, setGlobalMessages] = useState<IMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<IMessage[]>([]); // Stores all private messages
  const [groupMessages, setGroupMessages] = useState<{
    [groupId: string]: IMessage[];
  }>({}); // Stores messages per group

  // UI states for active chat
  const [selectedChatType, setSelectedChatType] = useState<
    "private" | "group" | "global" | null
  >(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null); // For private recipientId or groupId
  const [newMessage, setNewMessage] = useState("");

  // State to manage unread message counts for each chat
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(
    new Map()
  );

  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling chat

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    globalMessages,
    privateMessages,
    groupMessages,
    selectedChatId,
    selectedChatType,
  ]);

  // --- Socket Event Handlers ---
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log("Socket connected:", socket.id);
      setSocketStatus(`Connected (ID: ${socket.id})`);
      setError(null);
    };

    const handleDisconnect = () => {
      console.log("Socket disconnected");
      setSocketStatus("Disconnected");
      setIsLoggedIn(false);
      setOnlineUsers([]);
      setUserGroups([]);
      setGlobalMessages([]);
      setPrivateMessages([]);
      setGroupMessages({});
      setSelectedChatType(null);
      setSelectedChatId(null);
      setUnreadCounts(new Map()); // Clear unread counts on disconnect
    };

    const handleError = (errorMessage: string) => {
      console.error("Socket error:", errorMessage);
      setError(errorMessage);
    };

    // Helper to map backend MessageDocument to frontend IMessage
    const mapBackendMessageToFrontend = (backendMessage: any): IMessage => {
      return {
        id: backendMessage.serial, // Map backend 'serial' to frontend 'id'
        content: backendMessage.content,
        sender: backendMessage.sender, // Use backend's sender (Profile ObjectId)
        receiver: backendMessage.receiver, // Use backend's receiver (Profile ObjectId)
        groupId: backendMessage.groupId, // Use backend's groupId
        createdAt: backendMessage.createdAt, // Use backend's createdAt for timestamp
        updatedAt: backendMessage.updatedAt, // Use backend's updatedAt
        // Add other fields from backendMessage if needed, e.g., reports
      };
    };

    const handlePrivateMessage = (message: any) => {
      setPrivateMessages((prevMessages) => [
        ...prevMessages,
        mapBackendMessageToFrontend(message),
      ]);
      // Increment unread count if not the active private chat with this sender
      if (selectedChatType !== "private" || selectedChatId !== message.sender) {
        setUnreadCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set(message.sender, (newMap.get(message.sender) || 0) + 1);
          return newMap;
        });
      }
    };

    const handlePrivateMessageSent = (message: any) => {
      setPrivateMessages((prevMessages) => [
        ...prevMessages,
        mapBackendMessageToFrontend(message),
      ]);
      // If the sender is viewing the chat they just sent a message to, clear unread count for that recipient
      if (
        selectedChatType === "private" &&
        selectedChatId === message.receiver
      ) {
        setUnreadCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set(message.receiver, 0); // Clear unread for the recipient
          return newMap;
        });
      }
    };

    const handleGlobalMessage = (message: any) => {
      setGlobalMessages((prevMessages) => [
        ...prevMessages,
        mapBackendMessageToFrontend(message),
      ]);
      console.log(message);
      // Increment unread count if global chat is not active
      if (selectedChatType !== "global") {
        setUnreadCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set("global-chat", (newMap.get("global-chat") || 0) + 1);
          return newMap;
        });
      }
    };

    const handleGroupMessage = (message: any) => {
      if (message.groupId) {
        setGroupMessages((prev) => ({
          ...prev,
          [message.groupId!]: [
            ...(prev[message.groupId!] || []),
            mapBackendMessageToFrontend(message),
          ],
        }));
        // Increment unread count if not the active group chat
        if (
          selectedChatType !== "group" ||
          selectedChatId !== message.groupId
        ) {
          setUnreadCounts((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.groupId, (newMap.get(message.groupId) || 0) + 1);
            return newMap;
          });
        }
      }
    };

    const handleUserOnline = (user: IUser) => {
      console.log(`User online: ${user.username} (${user.id})`);
      setOnlineUsers((prev) => {
        if (!prev.some((u) => u.id === user.id)) {
          return [...prev, { ...user, isOnline: true, socketId: "" }];
        }
        return prev.map((u) =>
          u.id === user.id ? { ...u, isOnline: true } : u
        );
      });
    };

    const handleUserOffline = (user: { userId: string; username: string }) => {
      console.log(`User offline: ${user.username} (${user.userId})`);
      setOnlineUsers((prev) =>
        prev.map((u) => (u.id === user.userId ? { ...u, isOnline: false } : u))
      );
    };

    const handleOnlineUsers = (users: IUser[]) => {
      console.log("Updated online users list:", users);
      setOnlineUsers(users);
    };

    const handleGroupCreated = (group: any) => {
      console.log("Group created:", group);
      setUserGroups((prev) => [...prev, group]);
    };

    const handleUserJoinedGroup = (payload: {
      groupId: string;
      userId: string;
      username: string;
    }) => {
      console.log(`User ${payload.username} joined group ${payload.groupId}`);
      setUserGroups((prev) =>
        prev.map((group) =>
          group.id === payload.groupId &&
          !group.members.includes(payload.userId)
            ? { ...group, members: [...group.members, payload.userId] }
            : group
        )
      );
    };

    const handleUserLeftGroup = (payload: {
      groupId: string;
      userId: string;
      username: string;
    }) => {
      console.log(`User ${payload.username} left group ${payload.groupId}`);
      setUserGroups((prev) =>
        prev.map((group) =>
          group.id === payload.groupId
            ? {
                ...group,
                members: group.members.filter(
                  (memberId: string) => memberId !== payload.userId
                ),
              }
            : group
        )
      );
    };

    const handleAvailableGroups = (groups: any[]) => {
      console.log("Available groups:", groups);
      setUserGroups(groups);
    };

    const handleUserGroups = (groups: any[]) => {
      console.log("User's groups:", groups);
      setUserGroups(groups);
    };

    const handleConversationHistory = (payload: {
      recipientId: string;
      messages: any[];
    }) => {
      console.log(
        `Conversation history for ${payload.recipientId}:`,
        payload.messages
      );
      const mappedMessages = payload.messages.map(mapBackendMessageToFrontend);
      setPrivateMessages(mappedMessages);
      // Clear unread count when conversation history is fetched (i.e., chat is opened)
      setUnreadCounts((prev) => {
        const newMap = new Map(prev);
        newMap.set(payload.recipientId, 0);
        return newMap;
      });
    };

    const handleGroupHistory = (payload: {
      groupId: string;
      messages: any[];
    }) => {
      console.log(`Group history for ${payload.groupId}:`, payload.messages);
      const mappedMessages = payload.messages.map(mapBackendMessageToFrontend);
      setGroupMessages((prev) => ({
        ...prev,
        [payload.groupId]: mappedMessages,
      }));
      // Clear unread count when group history is fetched (i.e., chat is opened)
      setUnreadCounts((prev) => {
        const newMap = new Map(prev);
        newMap.set(payload.groupId, 0);
        return newMap;
      });
    };

    const handleMessageUpdated = (updatedMessage: any) => {
      const mappedMessage = mapBackendMessageToFrontend(updatedMessage);
      if (mappedMessage.groupId) {
        setGroupMessages((prev) => ({
          ...prev,
          [mappedMessage.groupId]: (prev[mappedMessage.groupId] || []).map(
            (msg) => (msg.id === mappedMessage.id ? mappedMessage : msg)
          ),
        }));
      } else if (mappedMessage.receiver) {
        setPrivateMessages((prev) =>
          prev.map((msg) => (msg.id === mappedMessage.id ? mappedMessage : msg))
        );
      } else {
        setGlobalMessages((prev) =>
          prev.map((msg) => (msg.id === mappedMessage.id ? mappedMessage : msg))
        );
      }
      console.log("Message updated:", updatedMessage);
    };

    const handleMessageDeleted = (payload: {
      messageSerial: string;
      groupId?: string;
    }) => {
      if (payload.groupId) {
        setGroupMessages((prev) => ({
          ...prev,
          [payload.groupId]: (prev[payload.groupId] || []).filter(
            (msg) => msg.id !== payload.messageSerial
          ),
        }));
      } else {
        setPrivateMessages((prev) =>
          prev.filter((msg) => msg.id !== payload.messageSerial)
        );
        setGlobalMessages((prev) =>
          prev.filter((msg) => msg.id !== payload.messageSerial)
        );
      }
      console.log("Message deleted:", payload.messageSerial);
    };

    const handleGroupChatHistoryCleared = (payload: {
      groupId: string;
      clearedBy: string;
    }) => {
      setGroupMessages((prev) => {
        const newGroupMessages = { ...prev };
        delete newGroupMessages[payload.groupId];
        return newGroupMessages;
      });
      console.log(
        `Group chat history cleared for group ${payload.groupId} by ${payload.clearedBy}`
      );
    };

    const handleForceDisconnect = (reason: string) => {
      console.warn(`Forced disconnect: ${reason}`);
      setError(`Disconnected by server: ${reason}. Please log in again.`);
      socket.disconnect();
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("error", handleError);
    socket.on("privateMessage", handlePrivateMessage);
    socket.on("privateMessageSent", handlePrivateMessageSent);
    // socket.on("globalMessage", handleGlobalMessage);
    socket.on("getGlobalMessages", handleGlobalMessage);
    socket.on("groupMessage", handleGroupMessage);
    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);
    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("groupCreated", handleGroupCreated);
    socket.on("userJoinedGroup", handleUserJoinedGroup);
    socket.on("userLeftGroup", handleUserLeftGroup);
    socket.on("availableGroups", handleAvailableGroups);
    socket.on("userGroups", handleUserGroups);
    socket.on("conversationHistory", handleConversationHistory);
    socket.on("groupHistory", handleGroupHistory); // New handler for group history
    socket.on("messageUpdated", handleMessageUpdated); // New handler for message updates
    socket.on("messageDeleted", handleMessageDeleted); // New handler for message deletions
    socket.on("groupChatHistoryCleared", handleGroupChatHistoryCleared); // New handler for group history cleared
    socket.on("forceDisconnect", handleForceDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("error", handleError);
      socket.off("privateMessage", handlePrivateMessage);
      socket.off("privateMessageSent", handlePrivateMessageSent);
      socket.off("globalMessage", handleGlobalMessage);
      socket.off("groupMessage", handleGroupMessage);
      socket.off("userOnline", handleUserOnline);
      socket.off("userOffline", handleUserOffline);
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("groupCreated", handleGroupCreated);
      socket.off("userJoinedGroup", handleUserJoinedGroup);
      socket.off("userLeftGroup", handleUserLeftGroup);
      socket.off("availableGroups", handleAvailableGroups);
      socket.off("userGroups", handleUserGroups);
      socket.off("conversationHistory", handleConversationHistory);
      socket.off("groupHistory", handleGroupHistory); // Clean up new handler
      socket.off("messageUpdated", handleMessageUpdated); // Clean up new handler
      socket.off("messageDeleted", handleMessageDeleted); // Clean up new handler
      socket.off("groupChatHistoryCleared", handleGroupChatHistoryCleared); // Clean up new handler
      socket.off("forceDisconnect", handleForceDisconnect);
    };
  }, [socket, selectedChatType, selectedChatId]); // Add selectedChatType and selectedChatId to dependencies

  // --- Login Function (emits userLogin event to gateway) ---
  const handleLogin = useCallback(() => {
    if (
      !socket.connected ||
      status !== "authenticated" ||
      !session?.user?.id ||
      !session?.user?.email
    ) {
      setError(
        "Cannot log in: Socket not connected or session not authenticated."
      );
      return;
    }

    socket.emit("userLogin", {
      userId: session.user.id,
      username: session.user.email,
    });

    setIsLoggedIn(true);
    setError(null);
    console.log(
      `Attempted login for User ID: ${session.user.id}, Username: ${session.user.email}`
    );
  }, [socket, session, status]);

  // --- Automatic Socket Login Effect (triggers handleLogin) ---
  useEffect(() => {
    if (socket.connected && status === "authenticated" && !isLoggedIn) {
      handleLogin();
    }
  }, [socket.connected, status, isLoggedIn, handleLogin]);

  // --- Fetch initial online users and groups after login ---
  useEffect(() => {
    if (isLoggedIn && socket.connected) {
      socket.emit("getOnlineUsers");
      socket.emit("getGroups");
    }
  }, [isLoggedIn, socket]);

  // --- UI Message Send Handler ---
  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    if (!isLoggedIn) {
      setError("You must be logged in to send messages.");
      return;
    }

    const messagePayload = { content: newMessage.trim() };

    if (selectedChatType === "private" && selectedChatId) {
      socket.emit("sendPrivateMessage", {
        recipientId: selectedChatId,
        ...messagePayload,
      });
    } else if (selectedChatType === "group" && selectedChatId) {
      socket.emit("sendGroupMessage", {
        groupId: selectedChatId,
        ...messagePayload,
      });
    } else if (selectedChatType === "global") {
      socket.emit("sendGlobalMessage", messagePayload);
    } else {
      setError("Please select a chat to send a message.");
      return;
    }

    setNewMessage("");
    setError(null);
  }, [newMessage, isLoggedIn, selectedChatType, selectedChatId, socket]);

  // Filter messages based on selected chat
  const currentChatMessages = React.useMemo(() => {
    const currentUserId = session?.user?.id;

    if (selectedChatType === "global") {
      return globalMessages;
    } else if (
      selectedChatType === "private" &&
      selectedChatId &&
      currentUserId
    ) {
      return privateMessages.filter(
        (msg) =>
          (msg.sender === currentUserId && msg.receiver === selectedChatId) ||
          (msg.sender === selectedChatId && msg.receiver === currentUserId)
      );
    } else if (selectedChatType === "group" && selectedChatId) {
      return groupMessages[selectedChatId] || [];
    }
    return [];
  }, [
    selectedChatType,
    selectedChatId,
    globalMessages,
    privateMessages,
    groupMessages,
    session?.user?.id,
  ]);

  // Prepare conversations for display in the left panel
  const displayConversations: IDisplayConversation[] = React.useMemo(() => {
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
      unread: unreadCounts.get("global-chat") || 0, // Get unread count
    });

    // Add Online Users
    onlineUsers.forEach((user) => {
      if (user.id !== session?.user?.id) {
        conversationsMap.set(`user-${user.id}`, {
          id: user.id,
          type: "user",
          name: user.username,
          online: user.isOnline,
          avatar: `/placeholder-user.jpg`,
          lastMessage: "", // This will be updated later if needed
          timestamp: "", // This will be updated later if needed
          unread: unreadCounts.get(user.id) || 0, // Get unread count
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
        unread: unreadCounts.get(group.id) || 0, // Get unread count
      });
    });

    // Update last message and timestamp for private chats
    privateMessages.forEach((msg) => {
      const currentUserId = session?.user?.id;
      let otherUserId = null;
      if (msg.sender === currentUserId && msg.receiver) {
        otherUserId = msg.receiver;
      } else if (msg.receiver === currentUserId && msg.sender) {
        otherUserId = msg.sender;
      }

      if (otherUserId && conversationsMap.has(`user-${otherUserId}`)) {
        const conv = conversationsMap.get(`user-${otherUserId}`);
        // Only update if this message is newer than the current lastMessage
        if (
          !conv.timestamp ||
          new Date(msg.createdAt) > new Date(conv.timestamp)
        ) {
          conversationsMap.set(`user-${otherUserId}`, {
            ...conv,
            lastMessage: msg.content,
            timestamp: new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        }
      }
    });

    // Sort conversations: global first, then users (online first), then groups
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
    privateMessages, // Added privateMessages to dependency array
    session?.user?.id,
    unreadCounts, // Added unreadCounts to dependency array
  ]);

  // Function to handle selecting a chat from the left panel
  const handleSelectChat = useCallback(
    (conv: IDisplayConversation) => {
      // Reset unread count for the selected chat
      setUnreadCounts((prev) => {
        const newMap = new Map(prev);
        newMap.set(conv.id, 0);
        if (conv.type === "global") {
          newMap.set("global-chat", 0); // Ensure global chat is also cleared
        }
        return newMap;
      });

      if (conv.type === "user") {
        setSelectedChatType("private");
        setSelectedChatId(conv.id);
        socket.emit("getConversation", { recipientId: conv.id });
      } else if (conv.type === "group") {
        setSelectedChatType("group");
        setSelectedChatId(conv.id);
        socket.emit("getGroupHistory", { groupId: conv.id });
      } else if (conv.type === "global") {
        setSelectedChatType("global");
        setSelectedChatId("global-chat");
      }
    },
    [socket]
  );

  // Get the display name for the chat header
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
        <div
          className={`${
            selectedChatId && "hidden md:block"
          } w-full md:w-80 bg-white border-r flex flex-col`}
        >
          {/* Desktop Header */}
          <div className="hidden md:block p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Messages</h2>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-6 h-6" />
              </Button>
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
                socketStatus.includes("Connected")
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {socketStatus} {isLoggedIn ? "(Logged In)" : "(Logged Out)"}
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
            {isLoggedIn && session?.user?.email && (
              <p className="text-sm text-gray-600 mt-2">
                Logged in as:{" "}
                <span className="font-semibold">{session.user.email}</span>
              </p>
            )}
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {displayConversations.map((conv) => (
                <div
                  key={
                    conv.type === "global" ? conv.id : `${conv.type}-${conv.id}`
                  }
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
                          conv.unread > 0 ? "font-bold" : ""
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

        {/* Chat Area - Right Panel */}
        {selectedChatId ? (
          <div
            className={`flex-1 flex flex-col bg-white ${
              !selectedChatId && "hidden"
            }`}
          >
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                {getChatHeaderAvatar()}
                <div>
                  <h3 className="font-semibold">{getChatHeaderName()}</h3>
                  <p className="text-sm text-gray-500">
                    {getChatHeaderStatus()}
                  </p>
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
                {currentChatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender === session?.user?.id
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`flex gap-2 max-w-xs lg:max-w-md ${
                        message.sender === session?.user?.id
                          ? "flex-row-reverse"
                          : ""
                      }`}
                    >
                      {/* Avatar for others' messages */}
                      {message.sender !== session?.user?.id && (
                        <Avatar className="w-8 h-8">
                          <AvatarImage
                            src="/placeholder.svg"
                            alt={message.sender}
                          />
                          <AvatarFallback>{message.sender[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          message.sender === session?.user?.id
                            ? "bg-blue-500 text-white rounded-br-md"
                            : "bg-gray-100 text-gray-900 rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            message.sender === session?.user?.id
                              ? "text-blue-100"
                              : "text-gray-500"
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
                ))}
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
                  disabled={
                    !newMessage.trim() || !isLoggedIn || !selectedChatId
                  }
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
        )}
      </div>
    </div>
  );
}
