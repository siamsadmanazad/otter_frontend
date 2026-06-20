"use client";
import { ShopPage } from "@/components/shop-page"
import { redirect } from "next/navigation"
import { SHOP_ENABLED } from "@/lib/flags"

interface ShopPageProps {
  params: {
    id: string
  }
}

export default function Shop({ params }: ShopPageProps) {
  if (!SHOP_ENABLED) redirect("/")
  // Shop ids are still integer-based mock data; kept uuid-unsafe behind the flag (fast-follow).
  const shopId = Number.parseInt(params.id)

  return <ShopPage shopId={shopId} onBack={() => {}} onProductSelect={() => {}} />
}
