"use client";

import { create } from 'zustand';

interface ContentStore {
  content: string;
  updateContent: (newContent: string) => void;
}

export const useContentStore = create<ContentStore>((set) => ({
  content: "",
  updateContent: (newContent: string) => set({ content: newContent }),
}));