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

export interface OnboardingPrefs {
  // Gate for the first-run onboarding flow; flips true once finished.
  completed: boolean;
  // Travel interests picked during onboarding (lowercase tokens). Editable
  // afterwards via the profile form (tribe_join_and_profile_depth.md D3c) —
  // this is the one live copy, not duplicated under `profile` below.
  interests: string[];
}

// Travel-identity fields collected in the richer profile form
// (tribe_join_and_profile_depth.md §D.3). Storage decision locked 2026-08-05:
// a `profile` namespace here rather than new `profiles` columns, since none of
// these fields are ever queried server-side — companions matching reads them
// back client-side the same way onboarding's `interests` already works.
// Empty string = not set (mirrors BusinessPrefs' convention below).
export interface ProfilePrefs {
  travelStyle: "" | "relaxed" | "adventure" | "mixed";
  budget: "" | "budget" | "mid" | "luxury";
}

export interface Preferences {
  notifications: NotificationPrefs;
  privacy: PrivacyPrefs;
  business: BusinessPrefs;
  onboarding: OnboardingPrefs;
  profile: ProfilePrefs;
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
  onboarding: {
    completed: false,
    interests: [],
  },
  profile: {
    travelStyle: "",
    budget: "",
  },
};

/** Merge a stored (possibly partial / `{}`) blob over the defaults. */
export function withDefaults(stored: any): Preferences {
  const s = stored && typeof stored === "object" ? stored : {};
  return {
    notifications: { ...DEFAULT_PREFERENCES.notifications, ...(s.notifications ?? {}) },
    privacy: { ...DEFAULT_PREFERENCES.privacy, ...(s.privacy ?? {}) },
    business: { ...DEFAULT_PREFERENCES.business, ...(s.business ?? {}) },
    onboarding: { ...DEFAULT_PREFERENCES.onboarding, ...(s.onboarding ?? {}) },
    profile: { ...DEFAULT_PREFERENCES.profile, ...(s.profile ?? {}) },
  };
}

/** Deep-merge a validated partial patch into the current preferences. */
export function mergePreferences(current: Preferences, patch: any): Preferences {
  const p = patch && typeof patch === "object" ? patch : {};
  return {
    notifications: { ...current.notifications, ...(p.notifications ?? {}) },
    privacy: { ...current.privacy, ...(p.privacy ?? {}) },
    business: { ...current.business, ...(p.business ?? {}) },
    onboarding: { ...current.onboarding, ...(p.onboarding ?? {}) },
    profile: { ...current.profile, ...(p.profile ?? {}) },
  };
}
