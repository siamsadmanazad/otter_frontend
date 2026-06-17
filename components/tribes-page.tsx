"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Users } from "lucide-react";

import { TribeCard } from "./tribes-page/tribe-card";
import { allGroups } from "@/data/mocks/group.mock";
import { useTribeAPI } from "@/lib/requests";
import { LoadingScreen } from "./ui/loading-splash";
import { TribesPage_Header_V1 } from "./tribes-page/tribe-header";
import { filterTribeStore } from "./tribes-page/tribe-store";
import { useStore } from '@nanostores/react';

interface ITribe {
  __v: number;
  _id: string;
  category: string;
  coverImage: string;
  createdAt: string;
  createdBy: string;
  description: string;
  name: string;
  privacy: "PUBLIC" | "PRIVATE";
  profileImage: string;
  serial: string;
  tags: string[];
  updatedAt: string;
}

export function TribesPage_V1() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filteredGroups, setFilteredGroups] = useState(allGroups);
  const filterState = useStore(filterTribeStore);

  const { data: tribes, isLoading, isError } = useQuery<ITribe[]>({
    queryKey: ["tribes", 1, 10],
    queryFn: async () => {
      const response = await useTribeAPI.getTribes(1, 10);
      return response.data;
    },
  });

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

  if (isLoading) return <LoadingScreen />;
  if (isError) return <div className="text-red-500">Failed to load groups</div>;
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white">
      <TribesPage_Header_V1>
      <div className="max-w-6xl mx-auto px-4 py-6">

        {
          filterState.tribes.length>0 ? 
          <section className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold dark:text-white">Searched Groups</h2>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                {tribes?.length ?? 0} groups found
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filterTribeStore.get().tribes?.map((group, index) => (
              <TribeCard key={index} group={group} />
            ))}
          </div>
        </section> : <div></div>
        }

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
                {tribes?.length ?? 0} groups found
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tribes?.map((group, index) => (
              <TribeCard key={index} group={group} />
            ))}
          </div>
        </section>
      </div>
      </TribesPage_Header_V1>
    </div>
  );
}
