"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { NotificationContainer } from "./notification-container";
import { MessageContainer } from "./message-container";
import Image from "next/image";

interface IDesktopHeader {
  setShowSearchModal: (showSearchModal: boolean) => void;
  session: any;
  handleLogout: () => void;
  userData: any;
}

export function DesktopHeader({
  setShowSearchModal,
  session,
  handleLogout,
  userData,
}: IDesktopHeader) {
  return (
    <div
      className="hidden md:block sticky top-0 z-10 border-b dark:border-gray-800
                 bg-gradient-to-br from-[#0099DB] to-[#00F0E4]"
    >
      <div className="max-w-full mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 ml-64">
            {/* Changed text color to white for better contrast with the gradient */}
            <Image src="/logo-nobg.webp" height={40} width={40} alt="logo" />
            {/* Link for the home/dashboard page */}
            <Link href="/" passHref>
              {/* Changed text color to white for better contrast with the gradient */}
              <h1 className="text-2xl font-bold cursor-pointer text-white">
                Tripotter
              </h1>
            </Link>
          </div>
          <div className="flex-1 max-w-xs mx-8">
            <Button
              variant="outline"
              // Adjusted button styles for better visibility on gradient background
              className="w-full justify-start text-white bg-white/20 border-white/30
                         hover:bg-white/30 dark:text-white dark:bg-white/10 dark:border-white/20 dark:hover:bg-white/20"
              onClick={() => setShowSearchModal(true)}
            >
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
          <div className="flex items-center gap-6 mr-8">
            <MessageContainer />
            <NotificationContainer />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="w-8 h-8 cursor-pointer dark:bg-gray-700 dark:text-gray-300">
                  <AvatarImage
                    src={userData?.profileImage ?? userData?.image}
                  />
                  <AvatarFallback>
                    {session?.user?.name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 dark:bg-gray-800 dark:border-gray-700"
              >
                <DropdownMenuItem className="cursor-pointer dark:text-gray-100 dark:hover:bg-gray-700">
                  <Link
                    href="/person/me"
                    shallow
                    className="cursor-pointer flex w-full"
                  >
                    <User className="w-4 h-4 mr-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                {/* Link for the Settings page */}
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  <Link href="/settings" passHref className="flex w-full">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 dark:text-red-400 dark:hover:bg-gray-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
