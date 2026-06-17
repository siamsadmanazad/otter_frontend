"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useWebsocket } from "@/lib/useWebsocket";
import type {
  IMessage,
  IUser,
  IDisplayConversation,
  Group,
} from "@/types/chat.d";
import { Socket } from "socket.io-client";

interface UseChatLogicProps {
  selectedChatType: "private" | "group" | "global" | "user" | null;
  selectedChatId: string | null;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  newMessage: string;
}

interface UseChatLogicReturn {
  socket: Socket | null;
  isLoggedIn: boolean;
  socketStatus: string;
  error: string | null;
  onlineUsers: IUser[];
  userGroups: Group[];
  globalMessages: IMessage[];
  privateMessages: IMessage[];
  groupMessages: { [groupId: string]: IMessage[] };
  unreadCounts: Map<string, number>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  handleLogin: () => void;
  handleSendMessage: () => void;
  handleSelectChat: (conv: IDisplayConversation) => void;
  emitCreateGroup: (groupName: string, memberIds: string[]) => void;
  emitJoinGroup: (groupId: string) => void;
  emitLeaveGroup: (groupId: string) => void;
  emitUpdateMessage: (messageSerial: string, content: string) => void;
  emitDeleteMessage: (messageSerial: string) => void;
  emitDeleteGroupChatHistory: (groupId: string) => void;
}

export function useChatLogic({
  selectedChatType,
  selectedChatId,
  setNewMessage,
  newMessage,
}: UseChatLogicProps): UseChatLogicReturn {
  const { data: session, status } = useSession();
  const socket = useWebsocket({
    path: "/chat",
    shouldAuthenticate: true,
    autoConnect: true,
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [socketStatus, setSocketStatus] = useState("Connecting...");
  const [error, setError] = useState<string | null>(null);

  const [onlineUsers, setOnlineUsers] = useState<IUser[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [globalMessages, setGlobalMessages] = useState<IMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<IMessage[]>([]);
  const [groupMessages, setGroupMessages] = useState<{
    [groupId: string]: IMessage[];
  }>({});
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(
    new Map()
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    globalMessages,
    privateMessages,
    groupMessages,
    selectedChatId,
    selectedChatType,
  ]);

  const mapBackendMessageToFrontend = useCallback(
    (backendMessage: any): IMessage => {
      return {
        id: backendMessage.serial,
        content: backendMessage.content,
        sender: backendMessage.sender ? String(backendMessage.sender) : "",
        receiver: backendMessage.receiver
          ? String(backendMessage.receiver)
          : undefined,
        groupId: backendMessage.groupId,
        createdAt: backendMessage.createdAt,
        updatedAt: backendMessage.updatedAt,
      };
    },
    []
  );

  // --- Socket Event Handlers ---
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setSocketStatus(`Connected (ID: ${socket.id})`);
      setError(null);
    };

    const handleDisconnect = () => {
      setSocketStatus("Disconnected");
      setIsLoggedIn(false);
      setOnlineUsers([]);
      setUserGroups([]);
      setGlobalMessages([]);
      setPrivateMessages([]);
      setGroupMessages({});
      setUnreadCounts(new Map());
    };

    const handleError = (errorMessage: string) => {
      console.error("Socket error:", errorMessage);
      setError(errorMessage);
    };

    const handleLoginSuccess = (payload: {
      userId: string;
      username: string;
    }) => {
      console.log(
        `Login successful for ${payload.username} (${payload.userId})`
      );
      setIsLoggedIn(true);
      setError(null);
      socket.emit("getOnlineUsers");
      if (selectedChatType === "global") {
        socket.emit("getGlobalMessages");
      }
    };

    const handleLoginFailure = (errorMessage: string) => {
      console.error("Login failed:", errorMessage);
      setIsLoggedIn(false);
      setError(`Login failed: ${errorMessage}`);
    };

    const handlePrivateMessage = (message: any) => {
      setPrivateMessages((prevMessages) => {
        const newMessages = [
          ...prevMessages,
          mapBackendMessageToFrontend(message),
        ];
        return newMessages;
      });
      if (selectedChatType !== "user" || selectedChatId !== message.sender) {
        setUnreadCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set(message.sender, (newMap.get(message.sender) || 0) + 1);
          return newMap;
        });
      }
    };

    const handlePrivateMessageSent = (message: any) => {
      setPrivateMessages((prevMessages) => {
        const newMessages = [
          ...prevMessages,
          mapBackendMessageToFrontend(message),
        ];
        return newMessages;
      });
      if (selectedChatType === "user" && selectedChatId === message.receiver) {
        setUnreadCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set(message.receiver, 0);
          return newMap;
        });
      }
    };

    const handleNewGlobalMessage = (message: any) => {
      setGlobalMessages((prevMessages) => {
        const newMessages = [
          ...prevMessages,
          mapBackendMessageToFrontend(message),
        ];
        return newMessages;
      });
      if (selectedChatType !== "global") {
        setUnreadCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set("global-chat", (newMap.get("global-chat") || 0) + 1);
          return newMap;
        });
      }
    };

    const handleGlobalMessagesHistory = (messages: any[]) => {
      const mappedMessages = messages.map(mapBackendMessageToFrontend);
      setGlobalMessages(mappedMessages);
      setUnreadCounts((prev) => {
        const newMap = new Map(prev);
        newMap.set("global-chat", 0);
        return newMap;
      });
    };

    const handleGroupMessage = (message: any) => {
      if (message.groupId) {
        setGroupMessages((prev) => {
          const groupId = message.groupId;
          const currentGroupMessages = prev[groupId] || [];
          const newGroupMessages = [
            ...currentGroupMessages,
            mapBackendMessageToFrontend(message),
          ];
          const updatedState = {
            ...prev,
            [groupId]: newGroupMessages,
          };
          return updatedState;
        });
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
      setOnlineUsers((prev) =>
        prev.map((u) => (u.id === user.userId ? { ...u, isOnline: false } : u))
      );
    };

    const handleOnlineUsers = (users: IUser[]) => {
      setOnlineUsers(users);
    };

    const handleGroupCreated = (group: Group) => {
      setUserGroups((prev) => {
        // Ensure we don't add duplicates if 'userGroups' also emits this
        if (!prev.some((g) => g.id === group.id)) {
          return [...prev, group];
        }
        return prev;
      });
      // After creating, the creator should automatically join the group's room
      // This is handled by the backend now in handleCreateGroup
    };

    const handleUserJoinedGroup = (payload: {
      groupId: string;
      userId: string;
      username: string;
    }) => {
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

    const handleUserGroups = (groups: Group[]) => {
      setUserGroups(groups);
    };

    const handleConversationHistory = (payload: {
      recipientId: string;
      messages: any[];
    }) => {
      const mappedMessages = payload.messages.map(mapBackendMessageToFrontend);
      setPrivateMessages(mappedMessages);
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
      const mappedMessages = payload.messages.map(mapBackendMessageToFrontend);
      setGroupMessages((prev) => {
        const updatedState = {
          ...prev,
          [payload.groupId]: mappedMessages,
        };
        return updatedState;
      });
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
    };

    const handleForceDisconnect = (reason: string) => {
      console.warn(`Forced disconnect: ${reason}`);
      setError(`Disconnected by server: ${reason}. Please log in again.`);
      socket.disconnect();
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("error", handleError);
    socket.on("loginSuccess", handleLoginSuccess);
    socket.on("loginFailure", handleLoginFailure);
    socket.on("privateMessage", handlePrivateMessage);
    socket.on("privateMessageSent", handlePrivateMessageSent);
    socket.on("globalMessage", handleNewGlobalMessage);
    socket.on("globalMessagesHistory", handleGlobalMessagesHistory);
    socket.on("groupMessage", handleGroupMessage);
    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);
    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("groupCreated", handleGroupCreated);
    socket.on("userJoinedGroup", handleUserJoinedGroup);
    socket.on("userLeftGroup", handleUserLeftGroup);
    socket.on("userGroups", handleUserGroups);
    socket.on("conversationHistory", handleConversationHistory);
    socket.on("groupHistory", handleGroupHistory);
    socket.on("messageUpdated", handleMessageUpdated);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("groupChatHistoryCleared", handleGroupChatHistoryCleared);
    socket.on("forceDisconnect", handleForceDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("error", handleError);
      socket.off("loginSuccess", handleLoginSuccess);
      socket.off("loginFailure", handleLoginFailure);
      socket.off("privateMessage", handlePrivateMessage);
      socket.off("privateMessageSent", handlePrivateMessageSent);
      socket.off("globalMessage", handleNewGlobalMessage);
      socket.off("globalMessagesHistory", handleGlobalMessagesHistory);
      socket.off("groupMessage", handleGroupMessage);
      socket.off("userOnline", handleUserOnline);
      socket.off("userOffline", handleUserOffline);
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("groupCreated", handleGroupCreated);
      socket.off("userJoinedGroup", handleUserJoinedGroup);
      socket.off("userLeftGroup", handleUserLeftGroup);
      // socket.off("availableGroups", handleAvailableGroups); // Removed listener
      socket.off("userGroups", handleUserGroups); // Primary listener for user's groups
      socket.off("conversationHistory", handleConversationHistory);
      socket.off("groupHistory", handleGroupHistory);
      socket.off("messageUpdated", handleMessageUpdated);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("groupChatHistoryCleared", handleGroupChatHistoryCleared);
      socket.off("forceDisconnect", handleForceDisconnect);
    };
  }, [socket, selectedChatType, selectedChatId, mapBackendMessageToFrontend]);

  // --- Login Function (emits userLogin event to gateway) ---
  const handleLogin = useCallback(() => {
    if (
      !socket?.connected ||
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

  }, [socket, session, status]);

  // --- Automatic Socket Login Effect (triggers handleLogin) ---
  useEffect(() => {
    if (socket?.connected && status === "authenticated" && !isLoggedIn) {
      handleLogin();
    }
  }, [socket?.connected, status, isLoggedIn, handleLogin]);

  // --- UI Message Send Handler ---
  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    if (!isLoggedIn) {
      setError("You must be logged in to send messages.");
      return;
    }

    const messagePayload = { content: newMessage.trim() };

    if (selectedChatType === "user" && selectedChatId) {
      socket?.emit("sendPrivateMessage", {
        recipientId: selectedChatId,
        ...messagePayload,
      });
    } else if (selectedChatType === "group" && selectedChatId) {
      socket?.emit("sendGroupMessage", {
        groupId: selectedChatId,
        ...messagePayload,
      });
    } else if (selectedChatType === "global") {
      socket?.emit("sendGlobalMessage", messagePayload);
    } else {
      setError("Please select a chat to send a message.");
      return;
    }

    setNewMessage("");
    setError(null);
  }, [newMessage, isLoggedIn, selectedChatType, selectedChatId, socket]);

  // Function to handle selecting a chat from the left panel
  const handleSelectChat = useCallback(
    (conv: IDisplayConversation) => {
      setUnreadCounts((prev) => {
        const newMap = new Map(prev);
        newMap.set(conv.id, 0);
        if (conv.type === "global") {
          newMap.set("global-chat", 0);
        }
        return newMap;
      });

      if (conv.type === "user") {
        socket?.emit("getConversation", { recipientId: conv.id });
      } else if (conv.type === "group") {
        // Emit joinGroup to ensure the socket is in the room
        socket?.emit("joinGroup", { groupId: conv.id });
        socket?.emit("getGroupHistory", { groupId: conv.id });
      } else if (conv.type === "global") {
        socket?.emit("getGlobalMessages");
      }
    },
    [socket]
  );

  // --- Group related emitters ---
  const emitCreateGroup = useCallback(
    (groupName: string, memberIds: string[]) => {
      if (socket?.connected && isLoggedIn) {
        socket.emit("createGroup", { groupName, memberIds });
      } else {
        setError("Not connected or logged in to create a group.");
      }
    },
    [socket, isLoggedIn]
  );

  const emitJoinGroup = useCallback(
    (groupId: string) => {
      if (socket?.connected && isLoggedIn) {
        socket.emit("joinGroup", { groupId });
      } else {
        setError("Not connected or logged in to join a group.");
      }
    },
    [socket, isLoggedIn]
  );

  const emitLeaveGroup = useCallback(
    (groupId: string) => {
      if (socket?.connected && isLoggedIn) {
        socket.emit("leaveGroup", { groupId });
      } else {
        setError("Not connected or logged in to leave a group.");
      }
    },
    [socket, isLoggedIn]
  );

  const emitUpdateMessage = useCallback(
    (messageSerial: string, content: string) => {
      if (socket?.connected && isLoggedIn) {
        socket.emit("updateMessage", { messageSerial, content });
      } else {
        setError("Not connected or logged in to update messages.");
      }
    },
    [socket, isLoggedIn]
  );

  const emitDeleteMessage = useCallback(
    (messageSerial: string) => {
      if (socket?.connected && isLoggedIn) {
        socket.emit("deleteMessage", { messageSerial });
      } else {
        setError("Not connected or logged in to delete messages.");
      }
    },
    [socket, isLoggedIn]
  );

  const emitDeleteGroupChatHistory = useCallback(
    (groupId: string) => {
      if (socket?.connected && isLoggedIn) {
        socket.emit("deleteGroupChatHistory", { groupId });
      } else {
        setError("Not connected or logged in to clear group history.");
      }
    },
    [socket, isLoggedIn]
  );

  return {
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
    handleLogin,
    handleSendMessage,
    handleSelectChat,
    emitCreateGroup,
    emitJoinGroup,
    emitLeaveGroup,
    emitUpdateMessage,
    emitDeleteMessage,
    emitDeleteGroupChatHistory,
  };
}
