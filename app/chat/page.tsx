import { ChatPage } from "@/components/chat-page/chat-page";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Chat",
      default: "Chat",
    },
    description: "Connect with your friends in TripOtter",
  };
}

export default function Chat() { 
    return (
        <div className="md:ml-[250px] mx-8">
            <ChatPage />
        </div>
    )
}