"use client";
import { signOut, useSession } from "next-auth/react";
import React, { useState } from "react";
import { MobileNavigation } from "./mobile/mobile-navigation";
import { DesktopSidebar } from "./desktop-sidebar";
import { DesktopHeader } from "./desktop-header";
import { useRouter } from "next/navigation";
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
  const [showSearchModal, setShowSearchModal] = useState(false);
  const { data: session } = useSession();

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

  if (session?.status === "loading" || isLoading) {
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
        {children}
        <MobileNavigation profileId={session?.user?.id}  />
      </>
    );
  } else {
    return <>{children}</>;
  }
}
