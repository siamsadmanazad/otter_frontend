import { ProductPage } from "@/components/product-page"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { SHOP_ENABLED } from "@/lib/flags"

interface ProductPageProps {
  params: {
    id: string
  }
  searchParams: {
    shopId?: string
  }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Product",
      default: "Product",
    },
  };
}

export default function Product({ params, searchParams }: ProductPageProps) {
  if (!SHOP_ENABLED) redirect("/")
  // Product/shop ids are still integer-based mock data; kept behind the flag (fast-follow to uuid).
  const productId = Number.parseInt(params.id)
  const shopId = searchParams.shopId ? Number.parseInt(searchParams.shopId) : undefined

  return <ProductPage productId={productId} shopId={shopId} onBack={() => {}} />
}
