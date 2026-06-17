
import { ForgotPasswordPage } from "@/components/forgot-password"
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Forgot Password",
      default: "Forgot Password",
    },
    description: "Log in to TripOtter",
  };
}

export default function ForgotPassword() {
  return <ForgotPasswordPage />
}
