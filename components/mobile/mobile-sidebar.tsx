"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Home,
  Users,
  Boxes,
  Settings,
  LogOut,
  Menu,
  MapPin,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export function Sidebar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const toggleSidebar = () => {
    setOpen((prev) => !prev);
  };

  const handleLogOut = async () => {
    try {
      await signOut({
        redirect: true,
        callbackUrl: "/login",
      });
    } catch (err) {
      console.error("Logout failed:", err);
      router.push("/login");
    }
  };

  // Close sidebar when clicking outside (only for desktop, Sheet handles mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !isMobile &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobile]);

  // Define navigation items
  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/companions", icon: Users, label: "Companions" },
    { href: "/chat", icon: MessageCircle, label: "Chat" },
    { href: "/groups", icon: Boxes, label: "Groups" },
    { href: "/shops", icon: MapPin, label: "Shops" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="rounded-full transition-all duration-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Menu className="h-6 w-6 text-slate-100 dark:text-gray-300" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          ref={sidebarRef}
          side="left"
          className={`
            w-full max-w-xs sm:max-w-md bg-gradient-to-br from-white to-gray-50 text-gray-900
            dark:from-gray-900 dark:to-gray-800 dark:text-gray-100
            border-r border-gray-200 dark:border-gray-700
            shadow-2xl transition-all duration-300 ease-in-out
            ${isMobile ? "inset-0 h-full" : ""}
          `}
        >
          <div className="flex h-full flex-col p-4">
            {/* Logo and Title */}
            <div className="flex flex-row items-center gap-3 mb-10 mt-4 px-4 justify-center">
              <Image src="/logo.webp" height={70} width={70} alt="logo" />
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 space-y-3 px-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-4 rounded-xl px-4 py-3 text-lg font-medium transition-all duration-200
                             text-gray-700 hover:bg-blue-100 hover:text-blue-700
                             dark:text-gray-300 dark:hover:bg-blue-900 dark:hover:text-blue-300
                             group shadow-sm hover:shadow-md"
                  onClick={() => setOpen(false)}
                >
                  <item.icon className="h-5 w-5 text-gray-500 group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400 transition-colors duration-200" />
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Logout Button */}
            <div className="mt-auto px-2 pt-4">
              <Button
                onClick={handleLogOut}
                className="w-full flex items-center justify-center gap-4 rounded-xl px-4 py-3 text-lg font-medium
                           bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl
                           dark:bg-red-700 dark:hover:bg-red-800 transition-all duration-200"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </Button>
            </div>

            {/* Footer */}
            <div className="mt-6 p-4 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
              &copy; {new Date().getFullYear()} Trip Otter. All rights reserved.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
