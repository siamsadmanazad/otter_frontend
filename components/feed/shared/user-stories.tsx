"use client";

import { useState } from "react";
import { PlusSquare } from "lucide-react";
import { Card, CardContent } from "../../ui/card";
import { ScrollArea } from "../../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { stories } from "@/data/mocks/feed.mock";

export function UserStories() {
  const [implemented, setImplemented] = useState(false);
  if (implemented) {
    return (
      <Card className="mb-6 bg-white dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-4">
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-2">
              {stories.map((story) => (
                <div
                  key={story.id}
                  className="flex flex-col items-center gap-1 min-w-0"
                >
                  <div
                    className={`relative ${
                      story.hasStory && !story.isOwn
                        ? "bg-gradient-to-tr from-yellow-400 to-pink-600 p-0.5 rounded-full"
                        : ""
                    }`}
                  >
                    <Avatar
                      className={`w-14 h-14 ${
                        story.hasStory && !story.isOwn
                          ? "border-2 border-white dark:border-gray-800"
                          : ""
                      }`}
                    >
                      <AvatarImage
                        src={story.avatar || "/placeholder.svg"}
                        alt={story.username}
                      />
                      <AvatarFallback className="dark:bg-gray-700 dark:text-gray-300">
                        {story.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {story.isOwn && (
                      <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 dark:bg-blue-700">
                        <PlusSquare className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-center truncate w-16 text-gray-700 dark:text-gray-300">
                    {story.username}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  } else {
    <></>;
  }
}
