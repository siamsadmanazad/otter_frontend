import { ProductPage } from "@/components/product-page"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { SHOP_ENABLED } from "@/lib/flags"

interface ProductPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    shopId?: string
  }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Product",
      default: "Product",
    },
  };
}

export default async function Product({ params, searchParams }: ProductPageProps) {
  if (!SHOP_ENABLED) redirect("/")
  // Product/shop ids are still integer-based mock data; kept behind the flag (fast-follow to uuid).
  const { id } = await params
  const { shopId: shopIdParam } = await searchParams
  const productId = Number.parseInt(id)
  const shopId = shopIdParam ? Number.parseInt(shopIdParam) : undefined

  return <ProductPage productId={productId} shopId={shopId} onBack={() => {}} />
}
