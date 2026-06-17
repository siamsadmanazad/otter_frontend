"use client";

import { useEffect, useState } from "react";
import { PostCard } from "@/components/feed/profile/post-card";
import { useWebsocket } from "@/lib/useWebsocket";
import { useSession } from "next-auth/react";

export default function PostPage({ postData }: { postData: any }) {
  const { data: session } = useSession();
    const [isConnected, setIsConnected] = useState(false);
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
  return (
    <div className="md:ml-[300px] mx-10">
      <PostCard post={postData} session={session} socket={socket} isSocketConnected={isConnected} />
    </div>
  );
}
