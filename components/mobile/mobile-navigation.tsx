"use client";
import { Home, PlusSquare, Users, MessageCircle, User } from "lucide-react";
import { Button } from "../ui/button";
import { usePathname, useRouter } from "next/navigation";

import Dynamic from "next/dynamic";
import { LoadingSmall } from "../ui/loading";

const CreatePost = Dynamic(
  () => import("../feed/shared/create-post").then((mod) => mod.CreatePost),
  {
    ssr: true,
    loading: () => (
      <Button className="bg-white dark:bg-black">
        <LoadingSmall />
      </Button>
    ),
  }
);

export function MobileNavigation({ profileId }: { profileId?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (match: (p: string) => boolean) => match(pathname);
  const activeCls = "text-[#0099DB] dark:text-[#00F0E4]";
  const idleCls =
    "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300";

  const cls = (active: boolean) => (active ? activeCls : idleCls);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="flex items-center justify-around py-1.5">
        {/* Home / Feed */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Home"
          className={cls(isActive((p) => p === "/" || p.startsWith("/feed") || p.startsWith("/home")))}
          onClick={() => router.push("/feed")}
        >
          <Home className="w-6 h-6" />
        </Button>

        {/* Tribes (the differentiator) */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tribes"
          className={cls(isActive((p) => p.startsWith("/tribes")))}
          onClick={() => router.push("/tribes")}
        >
          <Users className="w-6 h-6" />
        </Button>

        {/* Create (center) */}
        <CreatePost profileId={profileId ?? ""}>
          <Button
            size="icon"
            aria-label="Create post"
            className="bg-gradient-to-br from-[#0099DB] to-[#00F0E4] text-white rounded-xl shadow-md hover:opacity-90"
          >
            <PlusSquare className="w-6 h-6" />
          </Button>
        </CreatePost>

        {/* Chat */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Messages"
          className={cls(isActive((p) => p.startsWith("/chat")))}
          onClick={() => router.push("/chat")}
        >
          <MessageCircle className="w-6 h-6" />
        </Button>

        {/* Profile */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Profile"
          className={cls(isActive((p) => p.startsWith("/person")))}
          onClick={() => router.push(profileId ? `/person/${profileId}` : "/settings")}
        >
          <User className="w-6 h-6" />
        </Button>
      </div>
    </nav>
  );
}
