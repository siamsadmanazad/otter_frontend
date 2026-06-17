import { Metadata } from "next";
import Analytics from "./_components";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Analytics",
      default: "Analaytics",
      },
      description: "Tripotters analytics today"
  };
}

export default function Page() { 
    return <Analytics />;
}