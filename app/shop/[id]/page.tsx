"use client";
import { use } from "react"
import { ShopPage } from "@/components/shop-page"
import { redirect } from "next/navigation"
import { SHOP_ENABLED } from "@/lib/flags"

interface ShopPageProps {
  params: Promise<{
    id: string
  }>
}

export default function Shop({ params }: ShopPageProps) {
  if (!SHOP_ENABLED) redirect("/")
  // Shop ids are still integer-based mock data; kept uuid-unsafe behind the flag (fast-follow).
  const { id } = use(params)
  const shopId = Number.parseInt(id)

  return <ShopPage shopId={shopId} />
}
