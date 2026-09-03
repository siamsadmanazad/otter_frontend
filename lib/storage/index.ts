/**
 * Storage provider selection (MEDIA.md §6).
 *
 * WRITES follow the env flag `MEDIA_PROVIDER`. READS AND DELETES follow the
 * `media.provider` column on the row itself -- that distinction is the whole
 * migration strategy: flipping the flag changes only where NEW objects land,
 * while every object already written keeps being served and deleted from the
 * store it actually lives on. There is no big-bang migration, and the rollback
 * is the same env change in reverse.
 */
import { r2Provider } from "./r2";
import { supabaseProvider } from "./supabase";
import type { StorageProvider, StorageProviderId } from "./types";

export * from "./types";

const PROVIDERS: Record<StorageProviderId, StorageProvider> = {
  supabase: supabaseProvider,
  r2: r2Provider,
};

/** Where NEW uploads go. Defaults to supabase so an unset env is a no-op. */
export function activeProviderId(): StorageProviderId {
  return process.env.MEDIA_PROVIDER === "r2" ? "r2" : "supabase";
}

export function activeProvider(): StorageProvider {
  return PROVIDERS[activeProviderId()];
}

/**
 * The provider a stored object lives on. `null`/unknown means it predates the
 * `media.provider` column, which can only be Supabase -- that is what the
 * column's default and backfill encode, and treating unknown as supabase keeps
 * old rows deletable forever.
 */
export function providerFor(id: string | null | undefined): StorageProvider {
  return id === "r2" ? PROVIDERS.r2 : PROVIDERS.supabase;
}
