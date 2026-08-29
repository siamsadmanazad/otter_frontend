import { Metadata } from "next";
import { DeleteAccountPage } from "@/components/delete-account-page";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Delete Account",
      default: "Delete Account",
    },
    description: "Permanently delete your TripOtter account and data.",
  };
}

export default function DeleteAccount() {
  return <DeleteAccountPage />;
}
