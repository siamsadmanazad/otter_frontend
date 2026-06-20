"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { NotificationContainer } from "../notification-container";
import { Sidebar } from "./mobile-sidebar";
import { SearchModal } from "../search-modal";

export function MobileHeader() {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div
      className="md:hidden sticky top-0 z-10 dark:border-gray-800
                 bg-gradient-to-br from-[#0099DB] to-[#00F0E4] py-2 px-4"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <Sidebar />
          <h1 className="text-xl font-bold text-white">Tripotter</h1>
        </div>
        <div className="flex flex-row gap-4 items-center">
          <button
            onClick={() => setShowSearch(true)}
            aria-label="Search"
            className="text-white"
          >
            <Search className="w-6 h-6" />
          </button>
          <NotificationContainer />
        </div>
      </div>

      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onPersonSelect={(id: string) => {
          setShowSearch(false);
          router.push(`/person/${id}`);
        }}
        onShopSelect={() => setShowSearch(false)}
      />
    </div>
  );
}
