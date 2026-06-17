"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@nanostores/react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { X, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

import CreateTribeForm from "@/components/tribes-page/create-tribe";
import { useTribeAPI } from "@/lib/requests";
import {
  addTag,
  filterTribeStore,
  removeTag,
  setCategory,
  setPrivacy,
  setTribes,
} from "./tribe-store";
import { CATEGORIES, TAGS } from "./tribe.constants";

export function TribesPage_Header_V2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";

  const { data, refetch } = useQuery({
    queryKey: ["searchTribe", initialSearch, useStore(filterTribeStore)],
    queryFn: () => useTribeAPI.searchTribe(initialSearch, filterTribeStore.get()),
    enabled: !!initialSearch,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchQuery = e.target.value;
    router.push(`/tribes?search=${newSearchQuery}`);
  };

  const handleFilterSearch = () => {
    refetch();
    setTribes(data?.data || []);
  };

  return (
    <div className="bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white">
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <Input
                  placeholder="Search groups..."
                  defaultValue={initialSearch}
                  onChange={handleSearchChange}
                  className="pl-10 w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-white placeholder:text-gray-500"
                />
              </div>
              <div className="flex gap-2">
                <FilterDropdown onSearch={handleFilterSearch} />
                <CreateTribeForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FilterDropdown({ onSearch }: { onSearch: () => void }) {
  const filters = useStore(filterTribeStore);
  const [open, setOpen] = useState(false);

  const handleTagSelect = (tag: string) => {
    const currentTags = filters.tags;
    if (currentTags.includes(tag)) {
      removeTag(tag);
    } else {
      addTag(tag);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-4">
        <DropdownMenuLabel>Search Filters</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium mb-2">Privacy Type:</p>
            <RadioGroup
              onValueChange={setPrivacy}
              value={filters.privacy}
              className="flex items-center gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PUBLIC" id="public" />
                <label htmlFor="public" className="cursor-pointer">
                  Public
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PRIVATE" id="private" />
                <label htmlFor="private" className="cursor-pointer">
                  Private
                </label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Category:</p>
            <Select onValueChange={setCategory} value={filters.category}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat.toLocaleUpperCase()}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Tags:</p>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  Select tags...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="Search tags..." className="h-9" />
                  <CommandEmpty>No tags found.</CommandEmpty>
                  <CommandGroup>
                    {TAGS.map((tag) => (
                      <CommandItem
                        key={tag}
                        value={tag}
                        onSelect={() => handleTagSelect(tag)}
                        className={cn(
                          "cursor-pointer",
                          filters.tags.includes(tag) &&
                            "bg-accent text-accent-foreground"
                        )}
                      >
                        {tag}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="mt-2 flex flex-wrap gap-2">
              {filters.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-xs"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <Button onClick={onSearch} className="w-full mt-2">
          Search
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
