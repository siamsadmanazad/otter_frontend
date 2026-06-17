"use client";

import { Button } from "@/components/ui/button";
import { Home, Users, ShoppingBag, Settings, LogOut, LoaderPinwheel } from "lucide-react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function DesktopSidebar() {
  const pathname = usePathname();
  const handleLogout = async () => {
    try {
      await signOut({
        redirect: true,
        callbackUrl: "/login",
      });
      toast.success("Come back soon!");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Something went wrong during logout. Please try again.");
    }
  };

  return (
    <div className="hidden md:block fixed left-0 top-0 h-screen max-w-64 min-w-24 bg-white border-r pt-20 z-20 overflow-y-auto dark:bg-gray-900 dark:border-gray-700">
      <div className="p-4">
        <nav className="space-y-2">
          <Link href="/feed" passHref>
            <Button
              variant={pathname === "/feed" ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-12 text-base",
                pathname === "/"
                  ? "dark:bg-blue-700 dark:text-white" // Active state dark mode
                  : "dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100" // Inactive state dark mode
              )}
            >
              <Home className="w-5 h-5" />
              Home
            </Button>
          </Link>

          <Link href="/companions" passHref>
            <Button
              variant={pathname === "/companions" ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-12 text-base",
                pathname === "/companions"
                  ? "dark:bg-blue-700 dark:text-white" // Active state dark mode
                  : "dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100" // Inactive state dark mode
              )}
            >
              <Users className="w-5 h-5" />
              Companions
            </Button>
          </Link>

          <Link href="/tribes" passHref>
            <Button
              variant={
                pathname === "/tribes" || pathname.startsWith("/tribe")
                  ? "default"
                  : "ghost"
              }
              className={cn(
                "w-full justify-start gap-3 h-12 text-base",
                pathname === "/tribes" || pathname.startsWith("/tribe")
                  ? "dark:bg-blue-700 dark:text-white" // Active state dark mode
                  : "dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100" // Inactive state dark mode
              )}
            >
              <LoaderPinwheel className="w-5 h-5" />
              Tribes
            </Button>
          </Link>

          <Link href="/shop" passHref>
            <Button
              variant={pathname === "/shop" ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-12 text-base",
                pathname === "/shop"
                  ? "dark:bg-blue-700 dark:text-white" // Active state dark mode
                  : "dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100" // Inactive state dark mode
              )}
            >
              <ShoppingBag className="w-5 h-5" />
              Shops
            </Button>
          </Link>

          <Link href="/settings" passHref>
            <Button
              variant={pathname === "/settings" ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-12 text-base",
                pathname === "/settings"
                  ? "dark:bg-blue-700 dark:text-white" // Active state dark mode
                  : "dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100" // Inactive state dark mode
              )}
            >
              <Settings className="w-5 h-5" />
              Settings
            </Button>
          </Link>
        </nav>
      </div>
      <div className="absolute bottom-4 left-4 right-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-12 text-base text-red-600 dark:text-red-400 hover:dark:bg-gray-800"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </div>
    </div>
  );
}
