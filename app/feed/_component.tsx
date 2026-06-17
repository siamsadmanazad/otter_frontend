"use client";
import { SessionProvider } from "next-auth/react"
import { TripotterFeed } from "@/components/tripotter-feed"

export default function HomeComponent() {
  return (
    <SessionProvider>
      <TripotterFeed />
    </SessionProvider>
  )
}
