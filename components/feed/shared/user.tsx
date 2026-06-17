"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import Link from "next/link";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { IPostProps } from "@/types/post";
dayjs.extend(relativeTime);

export function User({ post }: { post: IPostProps }) { 
    return (
        <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 md:w-10 md:h-10">
            <AvatarImage
                src={post?.owner?.profileImage || "/placeholder.svg"}
                alt={post?.owner?.username}
            />
            <AvatarFallback>
                {post?.owner?.username?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
            </Avatar>
            <div>
            <Link
                href={`/person/${post?.owner?._id}`}
                className="font-semibold text-sm md:text-base"
            >
                {post?.owner?.username}
            </Link>
            <div className="text-xs text-gray-500">
                {dayjs(post.createdAt).fromNow()}
                {post?.location && ` • ${post?.location}`}
            </div>
            </div>
        </div>
    )
}
