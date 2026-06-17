"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWebsocket } from "@/lib/useWebsocket";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

// Set the base title
// const BASE_TITLE = "Tripotter";
// const CHAT_LABEL = "Chat";

export const MessageContainer = () => {
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [error, setError] = useState<string | null>(null);

  // Refs for title flashing
  const titleFlashInterval = useRef<NodeJS.Timeout | null>(null);
  const unreadCountRef = useRef(0);

  const socket = useWebsocket({
    path: "/chat",
    shouldAuthenticate: true,
    autoConnect: true,
  });

  // Keep ref in sync with state
  useEffect(() => {
    unreadCountRef.current = unreadMessageCount;
  }, [unreadMessageCount]);

  // // Function to start title flashing
  // const startTitleFlashing = useCallback(() => {
  //   if (titleFlashInterval.current) return; // Already flashing

  //   const flashTitle = `🔔 New Message! | ${BASE_TITLE}`;

  //   let isFlashTitle = false;
  //   titleFlashInterval.current = setInterval(() => {
  //     const currentCount = unreadCountRef.current;

  //     if (currentCount > 0) {
  //       if (isFlashTitle) {
  //         document.title = `${CHAT_LABEL}(${currentCount}) | ${BASE_TITLE}`;
  //       } else {
  //         document.title = flashTitle;
  //       }
  //       isFlashTitle = !isFlashTitle;
  //     } else {
  //       // Stop flashing if count reaches 0
  //       if (titleFlashInterval.current) {
  //         clearInterval(titleFlashInterval.current);
  //         titleFlashInterval.current = null;
  //       }
  //       document.title = `${CHAT_LABEL} | ${BASE_TITLE}`;
  //     }
  //   }, 1000); // Flash every 1 second
  // }, []);

  // // Function to stop title flashing
  // const stopTitleFlashing = useCallback(() => {
  //   if (titleFlashInterval.current) {
  //     clearInterval(titleFlashInterval.current);
  //     titleFlashInterval.current = null;
  //   }
  // }, []);

  // // Update document title whenever unread count changes
  // useEffect(() => {
  //   if (unreadMessageCount > 0) {
  //     const newTitle = `${CHAT_LABEL}(${unreadMessageCount}) | ${BASE_TITLE}`;
  //     document.title = newTitle;

  //     // Only start flashing if not already flashing
  //     if (!titleFlashInterval.current) {
  //       startTitleFlashing();
  //     }
  //   } else {
  //     stopTitleFlashing();
  //     document.title = `${CHAT_LABEL} | ${BASE_TITLE}`;
  //   }
  // }, [unreadMessageCount, startTitleFlashing, stopTitleFlashing]);

  // // Stop flashing when component unmounts or page becomes visible
  // useEffect(() => {
  //   const handleVisibilityChange = () => {
  //     if (!document.hidden) {
  //       stopTitleFlashing();
  //       // Set title to show current count without flashing when tab becomes visible
  //       if (unreadMessageCount > 0) {
  //         document.title = `${CHAT_LABEL}(${unreadMessageCount}) | ${BASE_TITLE}`;
  //       } else {
  //         document.title = `${CHAT_LABEL} | ${BASE_TITLE}`;
  //       }
  //     }
  //   };

  //   document.addEventListener("visibilitychange", handleVisibilityChange);

  //   return () => {
  //     stopTitleFlashing();
  //     document.removeEventListener("visibilitychange", handleVisibilityChange);
  //   };
  // }, [stopTitleFlashing, unreadMessageCount]);

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
      userId: session?.user?.id ?? "0",
      username: session?.user?.email,
    });
    console.log(
      `Attempted login for User ID: ${session?.user?.id}, Username: ${session?.user?.email}`
    );
  }, [socket, session, status]);

  useEffect(() => {
    if (socket) {
      socket.on("connect", () => {
        handleLogin();
        setIsConnected(true);
        console.log("Chat socket connected!");
      });
      socket.on("disconnect", () => {
        setIsConnected(false);
        console.log("Chat socket disconnected!");
      });
      return () => {
        socket.off("connect");
        socket.off("disconnect");
      };
    }
  }, [socket, handleLogin]);

  useEffect(() => {
    if (isConnected && socket && userId) {
      const handleMessage = (message: any) => {
        console.log("Message received:", message); // Debug log
        if (message.receiver === userId && message.sender !== userId) {
          console.log("Private message for this user"); // Debug log
          setUnreadMessageCount((prev) => prev + 1);
        } else if (message.type === "global" || message.type === "group") {
          console.log("Global/group message"); // Debug log
          // Optional: filter if needed
          setUnreadMessageCount((prev) => prev + 1);
        }
      };
      socket.on("privateMessage", handleMessage);
      socket.on("globalMessage", handleMessage);
      socket.on("groupMessage", handleMessage);
      return () => {
        socket.off("privateMessage", handleMessage);
        socket.off("globalMessage", handleMessage);
        socket.off("groupMessage", handleMessage);
      };
    }
  }, [isConnected, socket, userId]);

  const handleChatLinkClick = () => {
    setUnreadMessageCount(0);
    // stopTitleFlashing();
  };

  return (
    <Link href="/chat" passHref onClick={handleChatLinkClick}>
      <button
        className="relative p-2 rounded-full border-2 border-white text-white focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-white hover:text-black duration-300"
        aria-label={`Messages (${unreadMessageCount} unread)`}
      >
        <MessageCircle className="h-6 w-6" />
        {unreadMessageCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full transform translate-x-1/2 -translate-y-1/2">
            {unreadMessageCount}
          </span>
        )}
      </button>
    </Link>
  );
};
