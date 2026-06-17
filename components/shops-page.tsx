"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Heart, Filter, Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trendyProducts, shops } from "@/data/mocks/shop.mock";
import Link from "next/link";

export function ShopsPage() {
  const router = useRouter();
  const [isAlertOpen, setIsAlertOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredShops = shops.filter(
    (shop) =>
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white text-gray-950 dark:bg-gray-950 dark:text-gray-50">
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent className="bg-white border-gray-200 text-gray-950 dark:bg-gray-900 dark:border-gray-700 dark:text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-950 dark:text-white">
              Feature coming soon
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-300">
              The groups feature is under construction and will be available
              soon. Stay with Trip Otter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-950 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-white">
              <Link href="/" className="w-full">
                Back to Home
              </Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-950 dark:text-white">
            Shops
          </h1>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block bg-white border-b border-gray-200 p-4 dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-950 dark:text-white">
              Discover Shops
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search shops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-80 bg-gray-100 text-gray-950 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-950 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-white"
            >
              <Filter className="w-4 h-4 mr-2 text-gray-950 dark:text-white" />
              Filter
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="h-full">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {/* Trendy Products Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl md:text-2xl font-bold text-gray-950 dark:text-white">
                🔥 Trending for Tourism
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-gray-100 text-gray-950 dark:hover:bg-gray-800 dark:text-white"
              >
                View All
              </Button>
            </div>
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4">
                {trendyProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="min-w-[200px] md:min-w-[240px] hover:shadow-lg transition-shadow bg-white border-gray-200 text-gray-950 dark:bg-gray-900 dark:border-gray-800 dark:text-white"
                  >
                    <CardContent className="p-4">
                      <div className="relative mb-3">
                        <Image
                          src={product.image || "/placeholder.svg"}
                          alt={product.name}
                          width={200}
                          height={200}
                          className="w-full h-32 md:h-40 object-cover rounded-lg"
                        />
                        <Badge className="absolute top-2 left-2 bg-red-600 text-white">
                          Trending
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 bg-gray-100/80 hover:bg-gray-200/80 text-gray-950 dark:bg-gray-800/80 dark:hover:bg-gray-700/80 dark:text-white"
                        >
                          <Heart className="w-4 h-4 text-gray-950 dark:text-white" />
                        </Button>
                      </div>
                      <h3 className="font-semibold text-sm mb-2 line-clamp-2">
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
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                          onClick={() => router.push(`/shop/${product.shopId}`)}
                        >
                          View Shop
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Mobile Search */}
          <div className="md:hidden mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search shops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-100 text-gray-950 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Shops Grid */}
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-950 dark:text-white">
              Featured Shops
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShops.map((shop) => (
                <Card
                  key={shop.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow bg-white border-gray-200 text-gray-950 dark:bg-gray-900 dark:border-gray-800 dark:text-white"
                  onClick={() => router.push(`/shop/${shop.id}`)}
                >
                  <div className="relative">
                    <Image
                      src={shop.image || "/placeholder.svg"}
                      alt={shop.name}
                      width={400}
                      height={300}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 bg-gray-100/80 hover:bg-gray-200/80 text-gray-950 dark:bg-gray-800/80 dark:hover:bg-gray-700/80 dark:text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Heart className="w-4 h-4 text-gray-950 dark:text-white" />
                    </Button>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
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
                            <h3 className="font-semibold">{shop.name}</h3>
                            {shop.verified && (
                              <Badge
                                variant="secondary"
                                className="text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                              >
                                Verified
                              </Badge>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className="text-xs mt-1 border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"
                          >
                            {shop.specialty}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {shop.description}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{shop.rating}</span>
                          <span className="text-gray-500">
                            ({shop.reviews})
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span className="text-xs">{shop.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {shop.products} products
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-950 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-white"
                        >
                          Visit Shop
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export { shops, trendyProducts };
