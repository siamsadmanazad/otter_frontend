import { ProfileEditFormNoModal } from "@/components/profile-page/profile-edit-modal";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Account Settings",
      default: "Account Settings",
    },
  };
}

export default function AccountSettings() {
  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 md:ml-[300px] mt-4">
        <Link href="/settings">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-5">
          Account and Profile Settings
        </h1>
        <ProfileEditFormNoModal />
      </div>
    </div>
  );
}
