"use client";
import { ShopPage } from "@/components/shop-page"

interface ShopPageProps {
  params: {
    id: string
  }
}

export default function Shop({ params }: ShopPageProps) {
  const shopId = Number.parseInt(params.id)

  return <ShopPage shopId={shopId} onBack={() => {}} onProductSelect={() => {}} />
}
