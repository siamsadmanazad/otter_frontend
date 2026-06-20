"use client";
import { SessionProvider } from "@/lib/auth/session"
import { TripotterFeed } from "@/components/tripotter-feed"

export default function HomeComponent() {
  return (
    <SessionProvider>
      <TripotterFeed />
    </SessionProvider>
  )
}
