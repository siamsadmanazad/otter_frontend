"use client";
import { Crown, Flame, Lock, Users } from "lucide-react";
import { Button } from "../ui/button";
import { atom } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  CreatedTribesSection,
  PrivateTribesSection,
  PublicTribesSection,
  SuggestedTribesSection,
} from "./tribe-sections/tribe-sections";
import { TribesPage_Header_V2 } from "./tribe-header_v2";
import { TribeCard } from "./tribe-card";
import { useState } from "react";
import { allGroups } from "@/data/mocks/group.mock";
import { filterTribeStore } from "./tribe-store";
import { useQuery } from "@tanstack/react-query";
import { ITribe } from "@/types/tribes";
import { useTribeAPI } from "@/lib/requests";

export type TribeSectionKey = "created" | "public" | "private" | "suggested";

export const sectionsOrderStore = atom<TribeSectionKey[]>([
  "created",
  "public",
  "private",
  "suggested",
]);

export function bringSectionToFront(key: TribeSectionKey) {
  const current = sectionsOrderStore.get();
  const index = current.indexOf(key);
  if (index <= 0) return;

  const newOrder = [...current];
  newOrder.splice(index, 1);
  newOrder.unshift(key);
  sectionsOrderStore.set(newOrder);
}

const sectionComponentMap: Record<TribeSectionKey, React.ComponentType> = {
  created: CreatedTribesSection,
  public: PublicTribesSection,
  private: PrivateTribesSection,
  suggested: SuggestedTribesSection,
};

export default function TribesPage_V101() {
  const sectionsOrder = useStore(sectionsOrderStore);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filteredGroups, setFilteredGroups] = useState(allGroups);
  const filterState = useStore(filterTribeStore);

  const {
    data: tribes,
    isLoading,
    isError,
  } = useQuery<ITribe[]>({
    queryKey: ["tribes", 1, 10],
    queryFn: async () => {
      const response = await useTribeAPI.getTribes(1, 10);
      return response.data;
    },
  });
  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Tribes</h1>
        </div>
        <TribesPage_Header_V2 />
      </div>

      <div className="w-[500px] bg-slate-200/70 rounded-full p-2 flex flex-row gap-1 mb-6">
        <Button
          className="rounded-full"
          variant={sectionsOrder[0] === "created" ? "default" : "outline"}
          onClick={() => bringSectionToFront("created")}
        >
          <Crown />
          Created Tribes
        </Button>
        <Button
          className="rounded-full"
          variant={sectionsOrder[0] === "public" ? "default" : "outline"}
          onClick={() => bringSectionToFront("public")}
        >
          <Users />
          Public
        </Button>
        <Button
          className="rounded-full"
          variant={sectionsOrder[0] === "private" ? "default" : "outline"}
          onClick={() => bringSectionToFront("private")}
        >
          <Lock />
          Private
        </Button>
        <Button
          className="rounded-full"
          variant={sectionsOrder[0] === "suggested" ? "default" : "outline"}
          onClick={() => bringSectionToFront("suggested")}
        >
          <Flame />
          Suggested
        </Button>
      </div>

      <div className="flex flex-col gap-4">

        <div className="max-w-6xl mx-auto px-4 py-6">
          {filterState.tribes.length > 0 ? (
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2 rounded-lg">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold dark:text-white">
                    Searched Groups
                  </h2>
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
            </section>
          ) : (
            <div></div>
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

        {sectionsOrder.map((key) => {
          const Section = sectionComponentMap[key];
          return <Section key={key} />;
        })}
      </div>
    </div>
  );
}
