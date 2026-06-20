"use client";
import { signOut, useSession } from "@/lib/auth/session";
import React, { useState } from "react";
import { MobileNavigation } from "./mobile/mobile-navigation";
import { DesktopSidebar } from "./desktop-sidebar";
import { DesktopHeader } from "./desktop-header";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useUserApi } from "@/lib/requests";
import { SearchModal } from "./search-modal";
import { useQuery } from "@tanstack/react-query";
import { MobileHeader }from "./mobile/mobile-header";

export default function LayoutProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Chat is a full-screen experience — hide the bottom nav so it doesn't cover the
  // message input, and drop the bottom padding so the thread fills the screen.
  const hideMobileNav = pathname?.startsWith("/chat") ?? false;
  const [showSearchModal, setShowSearchModal] = useState(false);
  const { data: session, status } = useSession();

  const {
    data: userData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["userProfile", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) {
        return null;
      }
      const response = await useUserApi.getUser(session.user.id);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to fetch user data.");
      }
      return response.data;
    },
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const handleLogout = async () => {
    await signOut({
      redirect: true,
      callbackUrl: "/login",
    });
    router.push("/login");
    toast.success("Come back soon!");
  };

  if (status === "loading" || isLoading) {
    return <>{children}</>;
  }

  if (isError) {
    console.error("Error fetching user profile for layout:", error);
  }
  if (session?.user && userData) {
    return (
      <>
        <SearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onPersonSelect={() => {}}
          onShopSelect={() => {}}
        />
        <DesktopHeader
          setShowSearchModal={setShowSearchModal}
          session={session}
          handleLogout={handleLogout}
          userData={userData}
        />
        <MobileHeader />
        <DesktopSidebar />
        {/* Bottom padding clears the fixed mobile nav (+ iOS safe area); none on desktop or chat. */}
        <div className={hideMobileNav ? "" : "pb-16 md:pb-0"}>{children}</div>
        {!hideMobileNav && <MobileNavigation profileId={session?.user?.id} />}
      </>
    );
  } else {
    return <>{children}</>;
  }
}
