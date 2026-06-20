"use client";
import React, { useEffect, useState } from "react";
import { useWebsocket } from "@/lib/useWebsocket";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotificationApi } from "@/lib/requests";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

interface NotificationItem {
  id: string;
  type: "LIKE" | "COMMENT" | "FOLLOW" | "REPORT";
  targetType?: string;
  targetId?: string;
  message: string;
  read: boolean;
  createdAt: string;
  actor?: {
    id: string;
    username: string;
    fullName: string;
    profileImage?: string;
  };
}

const PAGE_SIZE = 20;
const NOTIF_KEY = ["notifications"];

export default function NotificationPage() {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const queryClient = useQueryClient();
  const socket = useWebsocket({
    path: "/notification",
    shouldAuthenticate: true,
    autoConnect: true,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: [...NOTIF_KEY, limit],
    queryFn: async () => {
      const response: any = await useNotificationApi.getNotifications(1, limit);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to load notifications.");
      }
      return (response.data ?? []) as NotificationItem[];
    },
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const canLoadMore = notifications.length >= limit;

  useEffect(() => {
    if (!socket) return;
    const onNew = () => queryClient.invalidateQueries({ queryKey: NOTIF_KEY });
    socket.on("newNotification", onNew);
    return () => socket.off("newNotification", onNew);
  }, [socket, queryClient]);

  const markAll = useMutation({
    mutationFn: () => useNotificationApi.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIF_KEY }),
  });

  const iconFor = (type: NotificationItem["type"]) => {
    switch (type) {
      case "LIKE":
        return "👍";
      case "COMMENT":
        return "💬";
      case "FOLLOW":
        return "👤";
      case "REPORT":
        return "🚨";
      default:
        return "🔔";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <div className="flex-1 md:ml-64 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-sm text-blue-600 hover:underline disabled:text-gray-400 dark:text-blue-400"
              >
                {markAll.isPending ? "Marking..." : "Mark all as read"}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center text-red-500 mt-10">
              Couldn&apos;t load notifications. Please try again.
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
              No notifications found
            </div>
          ) : (
            <>
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`flex items-center space-x-4 p-4 rounded-xl transition-colors duration-200 ease-in-out ${
                    notification.read
                      ? "bg-white dark:bg-gray-800"
                      : "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-700"
                  } shadow-md hover:shadow-lg`}
                >
                  <div className="flex-shrink-0">
                    <span className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl text-gray-600 dark:text-gray-400">
                      {iconFor(notification.type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        <span className="font-semibold">
                          {notification.actor?.fullName ?? "Someone"}
                        </span>{" "}
                        {notification.message}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                        {dayjs(notification.createdAt).fromNow()}
                      </span>
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </Card>
              ))}

              {canLoadMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
