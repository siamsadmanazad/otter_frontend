import { ProductPage } from "@/components/product-page"
import { Metadata } from "next"

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
  const productId = Number.parseInt(params.id)
  const shopId = searchParams.shopId ? Number.parseInt(searchParams.shopId) : undefined

  return <ProductPage productId={productId} shopId={shopId} onBack={() => {}} />
}
