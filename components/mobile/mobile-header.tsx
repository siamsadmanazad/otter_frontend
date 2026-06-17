"use client";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { NotificationContainer } from "../notification-container";
import { Sidebar } from "./mobile-sidebar";

export function MobileHeader() {
  return (
    <div
      className="md:hidden sticky top-0 z-10 dark:border-gray-800
                 bg-gradient-to-br from-[#0099DB] to-[#00F0E4] py-2 px-4"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <Sidebar />
          <h1 className="text-xl font-bold text-white">Tripotter</h1>
        </div>
        <div className="flex flex-row gap-4 items-center">
          <NotificationContainer />
          <Link href="/chat" passHref>
            <MessageCircle className="w-6 h-6 cursor-pointer text-white" />
          </Link>
        </div>
      </div>
    </div>
  );
}
