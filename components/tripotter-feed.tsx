"use client";

import { useSession } from "next-auth/react";

import { useRouter } from "next/navigation";

import { LoadingScreen } from "./ui/loading-splash";
import { SuggestedUserWrapper } from "./suggestedUsers";
import { UserStories } from "./feed/shared/user-stories";
import PostContainer from "./feed/home";


export function TripotterFeed() {
  const router = useRouter();
  const { status } = useSession();

  const isAuthenticated = status === "authenticated";

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    router.push("/login");
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      <div className="flex">
        <div className="flex-1 md:ml-64">
          <div className="max-w-6xl mx-auto flex gap-8 px-4 md:px-8 py-0 md:py-8">
            {/* Feed */}

            <div className="flex-1 max-w-none md:max-w-lg">
              {/* Stories */}
              <UserStories />

              {/* Posts */}
              <PostContainer/>
            </div>

            {/* Right Sidebar - Suggested Users */}
            <SuggestedUserWrapper />
          </div>
        </div>
      </div>
    </div>
  );
}
