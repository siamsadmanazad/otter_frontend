import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface ChatAttachment {
  type: string;
  path?: string;
  size?: number;
  duration?: number;
  url?: string;
  [key: string]: unknown;
}

/**
 * Resolve fresh signed URLs for every attachment that carries a storage `path`.
 * Requires the ADMIN client: chat-attachments' storage RLS is owner-path-scoped
 * only (see the storage_buckets migration), so another participant's actor
 * client can never sign a sender's object directly — the API mediates
 * cross-participant reads here, by design. Never persist the returned `url`;
 * it expires, `path` doesn't.
 */
export async function signAttachmentsForMessages<T extends { attachments?: ChatAttachment[] | null }>(
  admin: SupabaseClient,
  messages: T[]
): Promise<T[]> {
  const allPaths = [
    ...new Set(
      messages.flatMap((m) => (m.attachments ?? []).filter((a) => a?.path).map((a) => a.path as string))
    ),
  ];
  if (!allPaths.length) return messages;

  const { data } = await admin.storage.from(CHAT_ATTACHMENTS_BUCKET).createSignedUrls(allPaths, SIGNED_URL_TTL_SECONDS);
  const urlByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return messages.map((m) => ({
    ...m,
    attachments: (m.attachments ?? []).map((a) => (a?.path ? { ...a, url: urlByPath.get(a.path) ?? null } : a)),
  }));
}

/** Same as [signAttachmentsForMessages] for a single message's attachment list. */
export async function signAttachments(
  admin: SupabaseClient,
  attachments: ChatAttachment[] | null | undefined
): Promise<ChatAttachment[]> {
  const [signed] = await signAttachmentsForMessages(admin, [{ attachments }]);
  return signed.attachments ?? [];
}
