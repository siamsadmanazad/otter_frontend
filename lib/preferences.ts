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
  /**
   * Independent of whoCanMessage: that governs people; this governs BUSINESS
   * profiles specifically, on top of the booking-based directionality gate
   * (POST /api/chat/conversations -- a business normally needs a prior
   * booking with this explorer before it can open a new thread at all).
   * false is an absolute veto -- checked before the booking check, same
   * posture as whoCanMessage=NONE, so a real booking does not override it.
   * Default true: most people are fine hearing from businesses they've
   * booked with; this exists for the person who explicitly wants zero
   * business contact regardless.
   */
  allowBusinessMessages: boolean;
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

// Business Mode Phase 1.1 (business_mode.md, "The Fork") — the first-run
// intent choice, recorded once and never re-asked. `kind` is a client-side
// signal only ("what did they say they came here to do"), distinct from the
// authoritative `profiles.kind` (EXPLORER/BUSINESS) enum set by 0.2's
// create_business_profile() — choosing "host" here does not itself create a
// business profile, it just tells Phase 1.3's setup wizard to offer one.
export interface IntentPrefs {
  chosen: boolean;
  kind: "" | "explorer" | "business";
  chosenAt: string;
}

// achievement_tree.md Phase 8 — "Tend": the one limb of the achievement tree
// this person has chosen to focus on. A stated intention, changeable any time,
// with no lock-in and no penalty for switching — which is what separates it
// from a commitment device that punishes you.
//
// Stored as a preference rather than a column because nothing server-side
// queries it: it steers what the app *surfaces*, never what it grants.
export interface TreePrefs {
  /// An `AchievementLimb` name, or "" for no choice yet.
  tendLimb: string;
  /// A cosmetic `feature_key` the person owns and has equipped, or "" for the
  /// default tree. Owning and equipping are separate on purpose: buying a
  /// second skin must never silently replace the one you are wearing.
  skin: string;
  /// The frame cosmetic, equipped the same way and in its own slot — a frame
  /// and a skin are worn together, not instead of each other.
  frame: string;
  /// Up to three badge keys pinned to the front of the profile trophy case
  /// (the `slots_three` product). Empty means the default order.
  slots: string[];
}

export interface Preferences {
  notifications: NotificationPrefs;
  privacy: PrivacyPrefs;
  business: BusinessPrefs;
  onboarding: OnboardingPrefs;
  profile: ProfilePrefs;
  intent: IntentPrefs;
  tree: TreePrefs;
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
    allowBusinessMessages: true,
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
  intent: {
    chosen: false,
    kind: "",
    chosenAt: "",
  },
  tree: {
    tendLimb: "",
    skin: "",
    frame: "",
    slots: [],
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
    intent: { ...DEFAULT_PREFERENCES.intent, ...(s.intent ?? {}) },
    tree: { ...DEFAULT_PREFERENCES.tree, ...(s.tree ?? {}) },
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
    intent: { ...current.intent, ...(p.intent ?? {}) },
    tree: { ...current.tree, ...(p.tree ?? {}) },
  };
}
