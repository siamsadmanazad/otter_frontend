"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  X,
  Clock,
  TrendingUp,
  Users,
  Star,
  Wand2,
  Loader2,
  Hash,
} from "lucide-react";
import { ai } from "@/lib/gemini";
import { Textarea } from "@/components/ui/textarea";
import { recentSearches, trendingSearches } from "@/data/mocks/search.mock";
import { useSearchAPI } from "@/lib/requests";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AIResponse } from "@/components/ai-response";
import { AiSuggestionTab } from "./search-tab/ai-suggestion-tab";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonSelect: (personId: string) => void; // Changed to string for _id
  onGroupSelect?: (groupId: number) => void;
  onShopSelect: (shopId: string) => void; // Changed to string for _id
  children?: React.ReactNode;
}

interface FilteredResults {
  people: Array<{
    id: string;
    username: string;
    name: string;
    avatar?: string;
    verified?: boolean;
    followers?: number;
  }>;
  hashtags: Array<{
    id: string; // Can be post _id or a generated ID for the hashtag
    tag: string;
    count?: number;
  }>;
  // locations: Array<{
  //   id: number; // Only from mock data
  //   name: string;
  //   count: number;
  // }>;
  // groups: Array<{
  //   id: number; // Only from mock data
  //   name: string;
  //   avatar?: string;
  //   members: number;
  //   category: string;
  // }>;
  // shops: Array<{
  //   id: string;
  //   name: string;
  //   avatar?: string;
  //   rating?: number;
  //   products?: number;
  //   category?: string;
  // }>;
}

const initialFilteredResults: FilteredResults = {
  people: [],
  hashtags: [],
  // locations: [],
  // groups: [],
  // shops: [],
};

export function SearchModal({
  isOpen,
  onClose,
  onPersonSelect,
  onGroupSelect,
  onShopSelect,
  children,
}: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [filteredResults, setFilteredResults] = useState<FilteredResults>(
    initialFilteredResults
  );
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchSearchResults = useCallback(async () => {
    if (!searchQuery.trim()) {
      setFilteredResults({
        people: [],
        hashtags: [],
        // shops: [],
        // locations: [],
        // groups: [],
      });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let profileQuery = "";
      let shopQuery = "";
      let hashtagsQuery = "";
      let groupQuery = "";

      if (activeTab === "all") {
        profileQuery = searchQuery;
        shopQuery = searchQuery;
        hashtagsQuery = searchQuery;
        groupQuery = searchQuery;
      } else if (activeTab === "people") {
        profileQuery = searchQuery;
      } else if (activeTab === "shops") {
        shopQuery = searchQuery;
      } else if (activeTab === "hashtags") {
        hashtagsQuery = searchQuery;
      }

      const response = await useSearchAPI.search(
        "1",
        profileQuery,
        groupQuery,
        shopQuery,
        hashtagsQuery
      );

      const apiData = response.data;

      // const filteredLocations = mockSearchData.locations.filter((loc) =>
      //   loc.name.toLowerCase().includes(searchQuery.toLowerCase())
      // );
      // const filteredGroups = mockSearchData.groups.filter(
      //   (group) =>
      //     group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      //     group.category.toLowerCase().includes(searchQuery.toLowerCase())
      // );

      const newFilteredResults: FilteredResults = {
        people: (apiData.users || []).map((user: any) => ({
          id: user._id,
          username: user.username,
          name: user.fullName,
          avatar: user.profileImage || "/placeholder.svg",
          verified: false,
          followers: 0,
        })),
        // shops: (apiData.shops || []).map((shop: any) => ({
        //   id: shop._id,
        //   name: shop.name,
        //   avatar: shop.avatar || "/placeholder.svg",
        //   rating: shop.rating || 0,
        //   products: shop.products || 0,
        //   category: shop.category || "General",
        // })),
        hashtags: (apiData.hashtags || []).flatMap((post: any) =>
          post.hashtags.map((tag: string) => ({
            id: post._id + tag,
            tag: tag,
            count: 0,
          }))
        ),
        // locations: filteredLocations,
        // groups: filteredGroups,
      };

      setFilteredResults(newFilteredResults);
    } catch (err) {
      console.error("Error fetching search results:", err);
      setError("Failed to fetch search results. Please try again.");
      setFilteredResults(initialFilteredResults);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeTab]);

  useEffect(() => {
    if (activeTab !== "ai") {
      const handler = setTimeout(() => {
        fetchSearchResults();
      }, 300);

      return () => {
        clearTimeout(handler);
      };
    } else {
      setFilteredResults(initialFilteredResults);
    }
  }, [searchQuery, activeTab, fetchSearchResults]);

  const clearSearch = () => {
    setSearchQuery("");
    setFilteredResults({
      people: [],
      hashtags: [],
      // shops: [],
      // locations: [],
      // groups: [],
    });
  };

  // const handlePersonClick = (personId: string) => {
  //   onPersonSelect(personId);
  //   router.push(`/person/${personId}`);
  //   onClose();
  // };

  // const handleGroupClick = (groupId: number) => {
  //   if (onGroupSelect) {
  //     onGroupSelect(groupId);
  //   }
  //   onClose();
  // };

  // const handleShopClick = (shopId: string) => {
  //   onShopSelect(shopId);
  //   onClose();
  // };

  const renderResults = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-full py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading results...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-red-500 text-center py-8">
          <p>{error}</p>
          <p>Please try again later.</p>
        </div>
      );
    }

    const hasResults =
      filteredResults.people.length > 0 || filteredResults.hashtags.length > 0;
    // || filteredResults.locations.length > 0
    // || filteredResults.groups.length > 0
    // || filteredResults.shops.length > 0;

    if (!searchQuery && activeTab !== "ai") {
      return (
        <div className="space-y-6 py-4">
          {/* Recent Searches */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-sm">Recent</h3>
            </div>
            <div className="space-y-2">
              {recentSearches.map((search, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                  onClick={() => setSearchQuery(search.query)}
                >
                  <div className="flex items-center gap-3">
                    <search.icon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{search.query}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Trending */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-sm">Trending</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingSearches.map((trend, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer hover:bg-gray-200 rounded-md"
                  onClick={() => setSearchQuery(trend)}
                >
                  {trend}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (!hasResults && searchQuery && !loading) {
      return (
        <div className="text-center text-gray-500 py-8">
          No results found for "{searchQuery}" in this category.
        </div>
      );
    }

    return (
      <div className="space-y-6 py-4">
        {/* People Results */}
        {(activeTab === "all" || activeTab === "people") &&
          filteredResults.people.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                People
              </h3>
              <div className="space-y-2">
                {filteredResults.people.map((person) => (
                  <Link
                    key={person.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    href={`/person/${person.id}`}
                  >
                    <Avatar className="w-10 h-10 rounded-full">
                      <AvatarImage
                        src={person.avatar || "/placeholder.svg"}
                        alt={person.name}
                      />
                      <AvatarFallback>
                        {person.name ? person.name[0] : "N/A"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-sm">
                          {person.username}
                        </span>
                        {person.verified && (
                          <Star className="w-3 h-3 text-blue-500 fill-current" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {person.name}{" "}
                        {person.followers
                          ? `• ${person.followers} followers`
                          : ""}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        {/* Groups Results (from mock data) */}
        {/* {(activeTab === "all" || activeTab === "groups") &&
          filteredResults.groups.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Groups
              </h3>
              <div className="space-y-2">
                {filteredResults.groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => handleGroupClick(group.id)}
                  >
                    <Avatar className="w-10 h-10 rounded-full">
                      <AvatarImage
                        src={group.avatar || "/placeholder.svg"}
                        alt={group.name}
                      />
                      <AvatarFallback>{group.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{group.name}</div>
                      <div className="text-xs text-gray-500">
                        {group.members} members • {group.category}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}

        {/* Shops Results */}
        {/* {(activeTab === "all" || activeTab === "shops") &&
          filteredResults.shops.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Store className="w-4 h-4" />
                Shops
              </h3>
              <div className="space-y-2">
                {filteredResults.shops.map((shop) => (
                  <div
                    key={shop.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => handleShopClick(shop.id)}
                  >
                    <Avatar className="w-10 h-10 rounded-full">
                      <AvatarImage
                        src={shop.avatar || "/placeholder.svg"}
                        alt={shop.name}
                      />
                      <AvatarFallback>{shop.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{shop.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        {shop.rating ? <span>⭐ {shop.rating}</span> : null}
                        {shop.rating && shop.products ? <span>•</span> : null}
                        {shop.products ? (
                          <span>{shop.products} products</span>
                        ) : null}
                        {(shop.rating || shop.products) && shop.category ? (
                          <span>•</span>
                        ) : null}
                        {shop.category ? <span>{shop.category}</span> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}

        {/* Hashtags Results */}
        {(activeTab === "all" || activeTab === "hashtags") &&
          filteredResults.hashtags.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Hashtags
              </h3>
              <div className="flex flex-wrap gap-2">
                {filteredResults.hashtags.map((hashtag, index) => (
                  <Badge
                    key={hashtag.id || index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-gray-200 rounded-md"
                    onClick={() => setSearchQuery(hashtag.tag)}
                  >
                    {hashtag.tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

        {/* Locations Results (from mock data) */}
        {/* {(activeTab === "all" || activeTab === "locations") &&
          filteredResults.locations.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Locations
              </h3>
              <div className="space-y-2">
                {filteredResults.locations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => setSearchQuery(location.name)}
                  >
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {location.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {location.count} posts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="sr-only">Search</DialogTitle>
          {activeTab !== "ai" && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search people, hashtags, locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-12 text-base rounded-md"
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full"
                  onClick={clearSearch}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="px-6 flex-grow flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-grow flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-4 mt-4">
              {" "}
              {/* Changed to grid-cols-3 */}
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="people">People</TabsTrigger>
              {/* <TabsTrigger value="locations">Places</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="shops">Shops</TabsTrigger> */}
              <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
              <TabsTrigger
                value="ai"
                className="bg-blue-500 hover:bg-blue-500/50 transition ease-in-out duration-300 text-white font-bold"
              >
                {" "}
                <Wand2 className="mr-2 h-4 w-4" /> AI
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-grow mt-4 pb-4 px-1">
              <TabsContent value="all" className="mt-0">
                {renderResults()}
              </TabsContent>
              <TabsContent value="people" className="mt-0">
                {renderResults()}
              </TabsContent>
              {/* <TabsContent value="locations" className="mt-0">
                {renderResults()}
              </TabsContent>
              <TabsContent value="groups" className="mt-0">
                {renderResults()}
              </TabsContent>
              <TabsContent value="shops" className="mt-0">
                {renderResults()}
              </TabsContent> */}
              <TabsContent value="hashtags" className="mt-0">
                {renderResults()}
              </TabsContent>

              {/* AI Tab Content */}
              <TabsContent value="ai" className="mt-0">
                <AiSuggestionTab />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
