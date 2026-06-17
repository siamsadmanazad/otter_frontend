import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Providers from "./providers";
import { SEOKeyWords } from "@/components/ui/seo-keywords";

export const metadata: Metadata = {
  title: {
    template: "%s | Tripotter",
    default: "Tripotter",
  },
  description:
    "Tripotter is a social media platform for travelers to share their adventures, discover new destinations, and connect with fellow explorers.",
  openGraph: {
    title: "Tripotter",
    description:
      "Share your travel experiences and connect with a global community of travelers on Tripotter.",
    type: "website",
    images: [
      {
        url: "/banner.jpg",
        width: 1536,
        height: 1024,
        alt: "Tripotter Logo",
      },
    ],
  },
  metadataBase: new URL("https://tripotter.net"),
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/en-US",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body>
        <SEOKeyWords />
        <Toaster />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
