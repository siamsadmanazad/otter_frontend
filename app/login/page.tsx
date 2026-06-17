import { LoginPage } from "@/components/login-page"
import { Metadata } from "next";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Login",
      default: "Login",
    },
    description:
      "Tripotter is a social media platform for travelers to share their experiences and photos",
  };
}

export default function Login() {
  return <LoginPage />
}
