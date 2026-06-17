"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Heart, Share2, Filter, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { shops } from "./shops-page";
import { shopProducts } from "@/data/mocks/shop.mock";

interface ShopPageProps {
  shopId: number;
}

export function ShopPage({ shopId }: ShopPageProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const shop = shops.find((s) => s.id === shopId);
  const products = shopProducts[shopId as keyof typeof shopProducts] || [];

  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Shop Not Found</h2>
          <Link href="/">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-gray-50">
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-900 hover:bg-gray-100 dark:text-gray-50 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold truncate text-gray-900 dark:text-gray-50">
            {shop.name}
          </h1>
        </div>
      </div>

      {/* Shop Header */}
      <div className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="hidden md:block mb-4">
            <Link href="/">
              <Button
                variant="ghost"
                className="mb-4 text-gray-900 hover:bg-gray-100 dark:text-gray-50 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
          <div className="flex flex-col md:flex-row gap-6">
            <Image
              src={shop.image || "/placeholder.svg"}
              alt={shop.name}
              width={400}
              height={300}
              className="w-full md:w-80 h-48 md:h-60 object-cover rounded-lg"
            />
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="w-12 h-12">
                      <AvatarImage
                        src={shop.avatar || "/placeholder.svg"}
                        alt={shop.name}
                      />
                      <AvatarFallback className="bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {shop.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                          {shop.name}
                        </h1>
                        {shop.verified && (
                          <Badge className="bg-gray-100 text-gray-700 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            Verified
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="mt-1 border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300"
                      >
                        {shop.specialty}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {shop.description}
                  </p>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium text-gray-900 dark:text-gray-50">
                        {shop.rating}
                      </span>
                      <span className="text-gray-500">
                        ({shop.reviews} reviews)
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>{shop.location}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-gray-200 text-gray-900 dark:border-gray-700 dark:text-white bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    <Heart className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-gray-200 text-gray-900 dark:border-gray-700 dark:text-white bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Products ({filteredProducts.length})
          </h2>
          <div className="flex gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-3 pr-4 py-2 w-64 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="cursor-pointer hover:shadow-lg transition-shadow dark:hover:shadow-gray-800/50"
            >
              <Link href={`/product/${product.id}?shopId=${shopId}`}>
                <CardContent className="p-3 md:p-4">
                  <div className="relative mb-3">
                    <Image
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      width={300}
                      height={300}
                      className="w-full h-32 md:h-40 object-cover rounded-lg"
                    />
                    {product.originalPrice && (
                      <Badge className="absolute top-2 left-2 bg-red-600 text-white text-xs border-transparent dark:bg-red-700">
                        Sale
                      </Badge>
                    )}
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm mb-2 line-clamp-2 text-gray-900 dark:text-white">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {product.rating}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      ({product.reviews})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-600 dark:text-green-400">
                        ${product.price}
                      </span>
                      {product.originalPrice && (
                        <span className="text-xs text-gray-500 line-through">
                          ${product.originalPrice}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-gray-900 dark:text-white">
            <h3 className="text-lg font-semibold mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}

export { shopProducts };
