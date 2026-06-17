"use client";
import { useEffect, useState } from "react";
import { Home, PlusSquare, Search, Heart, User } from "lucide-react";
import { Button } from "../ui/button";
import { usePathname, useRouter } from "next/navigation";
import { SearchModal } from "../search-modal";

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

export function MobileNavigation({ profileId }: { profileId: any }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [currentPage, setCurrentPage] = useState<
    | "feed"
    | "chat"
    | "shops"
    | "shop"
    | "product"
    | "groups"
    | "group"
    | "people"
    | "person"
    | "settings"
    | null
  >(null);

  useEffect(() => {
    if (pathname === "/") {
      setCurrentPage("feed");
    } else if (pathname.includes("/tripeasy")) {
      setCurrentPage("chat");
    } else if (pathname.includes("/shops")) {
      setCurrentPage("shops");
    } else if (pathname.includes("/shop") && !pathname.includes("/shops")) {
      setCurrentPage("shop");
    } else if (pathname.includes("/product")) {
      setCurrentPage("product");
    } else if (pathname.includes("/groups") && !pathname.includes("/group")) {
      setCurrentPage("groups");
    } else if (pathname.includes("/group")) {
      setCurrentPage("group");
    } else if (pathname.includes("/person")) {
      setCurrentPage("person");
    } else {
      setCurrentPage(null);
    }
  }, [pathname]);

  // Callback when a person is selected from the modal
  const handlePersonSelect = (personId: string) => {
    router.push(`/person/${personId}`);
  };

  // Callback when a shop is selected
  const handleShopSelect = (shopId: string) => {
    router.push(`/shop/${shopId}`);
  };

  return (
    <>
      {/* Mobile Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-around py-2">
          {/* Home */}
          <Button
            variant="ghost"
            size="icon"
            className={
              currentPage === "feed"
                ? "text-black dark:text-white"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }
            onClick={() => router.push("/")}
          >
            <Home className="w-6 h-6" />
          </Button>

          {/* Search - Opens Modal */}
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => setShowSearchModal(true)}
            aria-label="Open search"
          >
            <Search className="w-6 h-6" />
          </Button>

          {/* Create Post */}
          <CreatePost profileId={profileId}>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <PlusSquare className="w-6 h-6" />
            </Button>
          </CreatePost>

          {/* Likes */}
          <Button
            variant="ghost"
            size="icon"
            className={
              currentPage === "person"
                ? "text-black dark:text-white"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }
            onClick={() => router.push("/person/likes")}
          >
            <Heart className="w-6 h-6" />
          </Button>

          {/* Profile */}
          <Button
            variant="ghost"
            size="icon"
            className={
              currentPage === "person"
                ? "text-black dark:text-white"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }
            onClick={() => router.push("/person/me")}
          >
            <User className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onPersonSelect={handlePersonSelect}
        onShopSelect={handleShopSelect}
      />
    </>
  );
}
