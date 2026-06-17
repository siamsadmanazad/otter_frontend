"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Users,
  TrendingUp,
  Filter,
  Moon,
} from "lucide-react";

import Link from "next/link";
import { allGroups, categories, trendingGroups } from "@/data/mocks/group.mock";
import { TribeCard } from "./tribe-card";

export function TribesPage_V2() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filteredGroups, setFilteredGroups] = useState(allGroups);

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    if (category === "All") {
      setFilteredGroups(allGroups);
    } else {
      setFilteredGroups(
        allGroups.filter((group) => group.category === category)
      );
    }
  };

  const handleJoinToggle = (groupId: number) => {
    setFilteredGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, isJoined: !group.isJoined } : group
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Discover Groups</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <Input
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-white placeholder:text-gray-500"
                  disabled
                />
              </div>
              <Button variant="outline" size="sm" disabled>
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                // The actual onClick for toggling the theme would be provided by next-themes.
                // For example: onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                // This button is just a placeholder and will not change the theme.
              >
                {/* The icon would also be dynamic based on the current theme from next-themes */}
                <Moon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Categories */}
        <div className="mb-8">
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {categories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <Button
                    key={category.name}
                    variant={
                      selectedCategory === category.name ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => handleCategoryFilter(category.name)}
                    className="flex items-center gap-2 whitespace-nowrap"
                    disabled
                  >
                    <IconComponent className="w-4 h-4" />
                    {category.name}
                    <Badge variant="secondary" className="ml-1">
                      {category.count}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Trending Groups */}
        {selectedCategory === "All" && (
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-r from-pink-500 to-orange-500 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold dark:text-white">
                  Trending Groups
                </h2>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Groups gaining popularity this week
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingGroups.map((group, index) => (
                <TribeCard key={index} group={group} isTrending />
              ))}
            </div>
          </section>
        )}

        {/* All Groups */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold dark:text-white">
                {selectedCategory === "All"
                  ? "All Groups"
                  : `${selectedCategory} Groups`}
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                {filteredGroups.length} groups found
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map((group, index) => (
              <TribeCard key={index} group={group} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
