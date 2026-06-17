import { Metadata } from "next";
import HomeComponent from "./_component";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Home",
      default: "Home",
    },
    description: "Tripotter is a social media platform for travelers to share their experiences and photos",
  };
}

export default function Home() {
  return <HomeComponent />
}
