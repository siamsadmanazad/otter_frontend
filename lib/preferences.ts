// Shared user-preference defaults + merge helpers. Defaults live here (not only in
// the DB) so existing rows with `{}` read sensible values everywhere they're consumed.

export type ProfileVisibility = "PUBLIC" | "FOLLOWERS" | "PRIVATE";
export type WhoCanMessage = "EVERYONE" | "FOLLOWERS" | "NONE";

export interface NotificationPrefs {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  mentions: boolean;
  email: boolean;
}

export interface PrivacyPrefs {
  profileVisibility: ProfileVisibility;
  whoCanMessage: WhoCanMessage;
  showActivity: boolean;
}

export interface BusinessPrefs {
  isBusiness: boolean;
  businessName: string;
  category: string;
  website: string;
  contactEmail: string;
}

export interface Preferences {
  notifications: NotificationPrefs;
  privacy: PrivacyPrefs;
  business: BusinessPrefs;
}

export const DEFAULT_PREFERENCES: Preferences = {
  notifications: {
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    mentions: true,
    email: false,
  },
  privacy: {
    profileVisibility: "PUBLIC",
    whoCanMessage: "EVERYONE",
    showActivity: true,
  },
  business: {
    isBusiness: false,
    businessName: "",
    category: "",
    website: "",
    contactEmail: "",
  },
};

/** Merge a stored (possibly partial / `{}`) blob over the defaults. */
export function withDefaults(stored: any): Preferences {
  const s = stored && typeof stored === "object" ? stored : {};
  return {
    notifications: { ...DEFAULT_PREFERENCES.notifications, ...(s.notifications ?? {}) },
    privacy: { ...DEFAULT_PREFERENCES.privacy, ...(s.privacy ?? {}) },
    business: { ...DEFAULT_PREFERENCES.business, ...(s.business ?? {}) },
  };
}

/** Deep-merge a validated partial patch into the current preferences. */
export function mergePreferences(current: Preferences, patch: any): Preferences {
  const p = patch && typeof patch === "object" ? patch : {};
  return {
    notifications: { ...current.notifications, ...(p.notifications ?? {}) },
    privacy: { ...current.privacy, ...(p.privacy ?? {}) },
    business: { ...current.business, ...(p.business ?? {}) },
  };
}
