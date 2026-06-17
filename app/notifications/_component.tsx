"use client";
import React, { useState, useEffect } from "react";
import { useWebsocket } from "@/lib/useWebsocket";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

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

export default function NotificationPage() {
  const [notifications, setNotifications] = useState<NotificationDocument[]>(
    []
  );
  const [isConnected, setIsConnected] = useState(false);
  const { data: session } = useSession();
  const userId = session?.user?.id;

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
      socket.emit("findUserNotification", userId, (response: any[]) => {
        if (response) {
          setNotifications(response);
        }
      });

      socket.on("newNotification", (newNotification: any) => {
        if (newNotification.receiver === userId) {
          setNotifications((prevNotifications) => [
            newNotification,
            ...prevNotifications,
          ]);
        }
      });

      socket.on("notificationUpdated", (updatedNotification: any) => {
        setNotifications((prevNotifications) =>
          prevNotifications.map((notif) =>
            notif._id === updatedNotification._id ? updatedNotification : notif
          )
        );
      });

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

  if (notifications) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex">
          <div className="flex-1 md:ml-64">

            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <Card
                  key={notification._id}
                  className={`flex items-center space-x-4 p-4 rounded-xl transition-colors duration-200 ease-in-out ${
                    notification.isRead
                      ? "bg-white dark:bg-gray-800"
                      : "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-700"
                  } shadow-md hover:shadow-lg`}
                >
                  <div className="flex-shrink-0">
                    <span className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl text-gray-600 dark:text-gray-400">
                      {notification.type === "LIKE" && "👍"}
                      {notification.type === "COMMENT" && "💬"}
                      {notification.type === "FOLLOW" && "👤"}
                      {notification.type === "REPORT" && "🚨"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        <span className="font-semibold">
                          {notification.createdBy.user.fullName}
                        </span>{" "}
                        {notification.content}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {dayjs(notification.createdAt).fromNow()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                      {notification.postUrl && (
                        <a
                          href={notification.postUrl}
                          className="text-blue-500 hover:underline"
                        >
                          View post
                        </a>
                      )}
                    </p>
                  </div>

                  {!notification.isRead && (
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </Card>
              ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
                No notifications found
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } else if (!notifications) {
    return <div>No notifications found</div>;
  } else {
    return <div>Loading...</div>;
  }
}
