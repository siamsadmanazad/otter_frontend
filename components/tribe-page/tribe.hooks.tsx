
import { create } from 'zustand';

interface TribeState {
  isTribeMember: boolean;
  isTribeAdmin: boolean;
  tribeId: string | null;

  setIsTribeMember: (isMember: boolean) => void;
  setIsTribeAdmin: (isAdmin: boolean) => void;
  setTribeId: (id: string | null) => void;

  reset: () => void;
}

export const useTribeStore = create<TribeState>((set) => ({
  isTribeMember: false,
  isTribeAdmin: false,
  tribeId: null,

  setIsTribeMember: (isMember) => set({ isTribeMember: isMember }),
  setIsTribeAdmin: (isAdmin) => set({ isTribeAdmin: isAdmin }),
  setTribeId: (id) => set({ tribeId: id }),

  reset: () =>
    set({
      isTribeMember: false,
      isTribeAdmin: false,
      tribeId: null,
    }),
}));