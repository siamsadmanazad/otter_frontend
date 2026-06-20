"use client";
import React, { useEffect } from "react";
import { useWebsocket } from "@/lib/useWebsocket";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotificationApi } from "@/lib/requests";

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

interface NotificationItem {
  id: string;
  type: "LIKE" | "COMMENT" | "FOLLOW" | "REPORT";
  targetType?: string;
  targetId?: string;
  message: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
  actor?: {
    id: string;
    username: string;
    fullName: string;
    profileImage?: string;
  };
}

const NOTIF_KEY = ["notifications"];

export const NotificationContainer = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const socket = useWebsocket({
    path: "/notification",
    shouldAuthenticate: true,
    autoConnect: true,
  });

  const { data } = useQuery({
    queryKey: NOTIF_KEY,
    queryFn: async () => {
      const response: any = await useNotificationApi.getNotifications(1, 50);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to load notifications.");
      }
      return (response.data ?? []) as NotificationItem[];
    },
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Live: a new notification INSERT for this user -> refetch (gets the enriched actor).
  useEffect(() => {
    if (!socket) return;
    const onNew = () => queryClient.invalidateQueries({ queryKey: NOTIF_KEY });
    socket.on("newNotification", onNew);
    return () => socket.off("newNotification", onNew);
  }, [socket, queryClient]);

  const markRead = useMutation({
    mutationFn: (id: string) => useNotificationApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIF_KEY }),
  });
  const markAll = useMutation({
    mutationFn: () => useNotificationApi.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIF_KEY }),
  });
  const removeOne = useMutation({
    mutationFn: (id: string) => useNotificationApi.deleteNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIF_KEY }),
  });

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString();

  const linkFor = (n: NotificationItem): string | null => {
    if ((n.type === "LIKE" || n.type === "COMMENT") && n.targetId)
      return `/post/${n.targetId}`;
    if (n.type === "FOLLOW" && n.actor?.id) return `/person/${n.actor.id}`;
    return null;
  };

  const getNotificationIcon = (type: string) => {
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

  const handleOpen = (n: NotificationItem) => {
    if (!n.read) markRead.mutate(n.id);
    const href = linkFor(n);
    if (href) router.push(href);
  };

  return (
    <DropdownMenu>
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
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className={`text-sm ${
                markAll.isPending
                  ? "text-gray-400 cursor-not-allowed dark:text-gray-500"
                  : "text-blue-600 hover:underline dark:text-blue-400 dark:hover:underline"
              }`}
            >
              {markAll.isPending ? "Marking..." : "Mark all as read"}
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
                key={notification.id}
                className={`p-4 border-b border-gray-100 dark:border-gray-700 ${
                  !notification.read
                    ? "bg-blue-50 hover:bg-blue-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                    : "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                } flex justify-between items-start`}
                onSelect={(e) => e.preventDefault()}
              >
                <div
                  className="flex items-start flex-1 cursor-pointer"
                  onClick={() => handleOpen(notification)}
                >
                  <span className="mr-3 dark:text-gray-200">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-100">
                      <span className="font-medium">
                        {notification.actor?.fullName ?? "Someone"}
                      </span>{" "}
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeOne.mutate(notification.id);
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
            onClick={() => router.push("/notifications")}
            className="text-blue-600 hover:underline text-sm dark:text-blue-400 dark:hover:underline"
          >
            See All
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
