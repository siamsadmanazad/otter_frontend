"use client";
import { ITribe } from "@/types/tribes";
import { atom } from "nanostores";

export const filterTribeStore = atom({
  privacy: "public",
  category: '',
  tags: [] as string[],
  tribes: [] as ITribe[],
});

export function setPrivacy(privacy: string) {
  filterTribeStore.set({ ...filterTribeStore.get(), privacy });
}

export function setCategory(category: string) {
  filterTribeStore.set({ ...filterTribeStore.get(), category });
}

export function addTag(tag: string) {
  const currentTags = filterTribeStore.get().tags;
  if (!currentTags.includes(tag)) {
    filterTribeStore.set({ ...filterTribeStore.get(), tags: [...currentTags, tag] });
  }
}

export function removeTag(tag: string) {
  filterTribeStore.set({
    ...filterTribeStore.get(),
    tags: filterTribeStore.get().tags.filter((t) => t !== tag),
  });
}

export function setTribes(tribes: ITribe[]) {
  filterTribeStore.set({ ...filterTribeStore.get(), tribes });
}