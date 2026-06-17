import { SignupPage } from "@/components/signup-page"
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Sign up",
      default: "Sign up",
    },
  };
}


export default function Signup() {
  return <SignupPage />
}
