"use client";
import React, { useState, useEffect, useRef } from "react";
import { useWebsocket } from "@/lib/useWebsocket";
import { useSession } from "next-auth/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface NotificationDocument {
  _id?: string;
  serial: string;
  createdBy: {
    user: {
      _id: string;
      fullName: string;
      username: "string";
    };
  };
  receiver: string;
  type: "LIKE" | "COMMENT" | "FOLLOW" | "REPORT";
  content: string;
  postUrl?: string;
  createdAt: string;
  isRead: boolean;
}

export const NotificationContainer = () => {
  const [notifications, setNotifications] = useState<NotificationDocument[]>(
    []
  );
  const [isConnected, setIsConnected] = useState(false);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const markAllTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const socket = useWebsocket({
    path: "/notification",
    shouldAuthenticate: true,
    autoConnect: true,
  });

  useEffect(() => {
    if (socket) {
      socket.on("connect", () => {
        setIsConnected(true);
      });
      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      return () => {
        socket.off("connect");
        socket.off("disconnect");
      };
    }
  }, [socket]);

  useEffect(() => {
    if (isConnected && socket && userId) {
      socket.emit(
        "findUserNotification",
        userId,
        (response: any[]) => {
          if (response) {
            setNotifications(response);
          }
        }
      );

      socket.on("newNotification", (newNotification: any) => {
        if (newNotification.receiver === userId) {
          setNotifications((prevNotifications) => [
            newNotification,
            ...prevNotifications,
          ]);
        }
      });

      socket.on(
        "notificationUpdated",
        (updatedNotification: any) => {
          setNotifications((prevNotifications) =>
            prevNotifications.map((notif) =>
              notif._id === updatedNotification._id
                ? updatedNotification
                : notif
            )
          );
        }
      );

      socket.on("notificationRemoved", (removedNotificationId: string) => {
        setNotifications((prevNotifications) =>
          prevNotifications.filter(
            (notif) => notif._id !== removedNotificationId
          )
        );
      });

      return () => {
        socket.off("newNotification");
        socket.off("notificationUpdated");
        socket.off("notificationRemoved");
      };
    }
  }, [isConnected, socket, userId]);

  const markAsRead = (id: string) => {
    if (socket) {
      const notificationToUpdate = notifications.find((n) => n._id === id);
      if (notificationToUpdate && !notificationToUpdate.isRead) {
        socket.emit(
          "isNotificationRead",
          id,
          (response: any | null) => {
            if (response) {
              setNotifications((prev) =>
                prev.map((notif) =>
                  notif._id === response._id ? response : notif
                )
              );
            } else {
              setNotifications((prev) =>
                prev.map((notif) =>
                  notif._id === id ? { ...notif, isRead: true } : notif
                )
              );
            }
          }
        );
      }
    }
  };

  const markAllAsReadDebounced = () => {
    if (isMarkingAllAsRead) return;

    if (markAllTimeoutRef.current) {
      clearTimeout(markAllTimeoutRef.current);
    }

    markAllTimeoutRef.current = setTimeout(() => {
      if (socket && !isMarkingAllAsRead) {
        setIsMarkingAllAsRead(true);

        const unreadNotifications = notifications.filter(
          (notif) => !notif.isRead
        );

        if (unreadNotifications.length === 0) {
          setIsMarkingAllAsRead(false);
          return;
        }

        const batchSize = 5;
        const batches = [];

        for (let i = 0; i < unreadNotifications.length; i += batchSize) {
          batches.push(unreadNotifications.slice(i, i + batchSize));
        }

        const processBatch = async (batchIndex: number) => {
          if (batchIndex >= batches.length) {
            setIsMarkingAllAsRead(false);
            return;
          }

          const batch = batches[batchIndex];
          const promises = batch.map((notif) => {
            return new Promise<void>((resolve) => {
              socket.emit(
                "isNotificationRead",
                notif._id!,
                (response: any | null) => {
                  if (!response) {
                    setNotifications((prev) =>
                      prev.map((n) =>
                        n._id === notif._id ? { ...n, isRead: true } : n
                      )
                    );
                  }
                  resolve();
                }
              );
            });
          });

          await Promise.all(promises);

          setTimeout(() => processBatch(batchIndex + 1), 100);
        };

        processBatch(0);
      }
    }, 300);
  };

  const handleDeleteNotification = (id: string) => {
    if (socket) {
      socket.emit(
        "removeNotification",
        id,
        (response: any | null) => {
          if (response) {
            setNotifications((prevNotifications) =>
              prevNotifications.filter((notif) => notif._id !== response._id)
            );
          } else {
            setNotifications((prevNotifications) =>
              prevNotifications.filter((notif) => notif._id !== id)
            );
          }
        }
      );
    }
  };

  useEffect(() => {
    return () => {
      if (markAllTimeoutRef.current) {
        clearTimeout(markAllTimeoutRef.current);
      }
    };
  }, []);

  const unreadCount = notifications.filter((notif) => !notif.isRead).length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getNotificationIcon = (type: any) => {
    switch (type) {
      case "LIKE":
        return <Heart className="h-5 w-5" />;
      case "COMMENT":
        return <MessageCircle className="h-5 w-5" />;
      case "FOLLOW":
        return <UserPlus className="h-5 w-5" />;
      case "REPORT":
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && unreadCount > 0) {
          markAllAsReadDebounced();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 text-white rounded-full border-2 border-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-gray-600 dark:focus:ring-blue-400 hover:bg-white hover:text-black duration-300"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 dark:text-white" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full transform translate-x-1/2 -translate-y-1/2">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 md:w-96 p-0 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
        <DropdownMenuLabel className="flex justify-between items-center p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsReadDebounced}
              disabled={isMarkingAllAsRead}
              className={`text-sm ${
                isMarkingAllAsRead
                  ? "text-gray-400 cursor-not-allowed dark:text-gray-500"
                  : "text-blue-600 hover:underline dark:text-blue-400 dark:hover:underline"
              }`}
            >
              {isMarkingAllAsRead ? "Marking..." : "Mark all as read"}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="dark:bg-gray-700" />
        <DropdownMenuGroup className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <DropdownMenuItem
              className="p-4 text-gray-500 text-center justify-center dark:text-gray-400"
              disabled
            >
              No new notifications.
            </DropdownMenuItem>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification._id}
                className={`p-4 border-b border-gray-100 dark:border-gray-700 ${
                  !notification.isRead
                    ? "bg-blue-50 hover:bg-blue-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                    : "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                } flex justify-between items-start`}
                onSelect={(e) => e.preventDefault()}
              >
                <div
                  className="flex items-start flex-1 cursor-pointer"
                  onClick={() => markAsRead(notification._id!)}
                >
                  <span className="mr-3 dark:text-gray-200">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-100">
                      <span className="font-medium">
                        {notification?.createdBy?.user?.fullName ?? " "}
                      </span>{" "}
                      {notification.content}
                    </p>
                    {notification.postUrl && (
                      <a
                        href={notification.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-xs mt-1 block dark:text-blue-400 dark:hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Post
                      </a>
                    )}
                    <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNotification(notification._id!);
                  }}
                  className="ml-2 p-1 rounded-full hover:bg-gray-200 text-gray-500 hover:text-red-500 transition-colors duration-200 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-red-400"
                  aria-label="Delete notification"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="dark:bg-gray-700" />
        <DropdownMenuItem className="p-2 text-center justify-center">
          <button
            onClick={() => {
              router.push("/notifications")
            }}
            className="text-blue-600 hover:underline text-sm dark:text-blue-400 dark:hover:underline"
          >
            See All
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};