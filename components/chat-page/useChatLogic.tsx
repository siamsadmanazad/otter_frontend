"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth/session";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import { useChatApi } from "@/lib/requests";
import type { Conversation, ChatMessage, ChatUser } from "@/types/chat.d";

const CONV_KEY = ["chat", "conversations"];
const PAGE = 30;

/**
 * Direct-message chat, backed by the Supabase chat API (`useChatApi`) for
 * history/send/read and by a Supabase Realtime channel for live delivery.
 * RLS on `messages` scopes the realtime stream to the caller's conversations,
 * so we can subscribe to all INSERTs and trust the DB to filter (same pattern
 * the notification shim uses).
 */
export function useChatLogic() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: isLoadingConversations } =
    useQuery({
      queryKey: CONV_KEY,
      queryFn: async () => {
        const res: any = await useChatApi.getConversations();
        if (res.status !== 200)
          throw new Error(res.message || "Failed to load conversations");
        return (res.data ?? []) as Conversation[];
      },
      enabled: !!currentUserId,
    });

  // Refs so the single realtime subscription can read the latest state.
  const activeIdRef = useRef<string | null>(null);
  const convRef = useRef<Conversation[]>([]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    convRef.current = conversations;
  }, [conversations]);

  const resolveSender = useCallback(
    (senderId: string, conversationId: string): ChatUser | undefined => {
      if (senderId === currentUserId) {
        return {
          id: currentUserId,
          username: session?.user?.username ?? "",
          fullName: session?.user?.name ?? "",
          profileImage: session?.user?.image ?? null,
        };
      }
      const conv = convRef.current.find((c) => c.id === conversationId);
      return conv?.otherUser ?? undefined;
    },
    [currentUserId, session]
  );

  const appendMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) =>
      prev.some((x) => x.id === m.id) ? prev : [...prev, m]
    );
  }, []);

  // One realtime subscription for the caller's messages (RLS-scoped).
  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const r: any = payload.new;
          const msg: ChatMessage = {
            id: r.id,
            conversationId: r.conversation_id,
            senderId: r.sender_id,
            content: r.content,
            attachments: r.attachments ?? [],
            createdAt: r.created_at,
            sender: resolveSender(r.sender_id, r.conversation_id),
          };
          if (r.conversation_id === activeIdRef.current) {
            appendMessage(msg);
            if (r.sender_id !== currentUserId) {
              useChatApi.markConversationRead(r.conversation_id).catch(() => {});
            }
          }
          queryClient.invalidateQueries({ queryKey: CONV_KEY });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, appendMessage, resolveSender, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const res: any = await useChatApi.getMessages(
        conversationId,
        undefined,
        PAGE
      );
      const list = (res?.data ?? []) as ChatMessage[];
      setMessages(list);
      setHasMore(list.length >= PAGE);
    } catch {
      setMessages([]);
      setHasMore(false);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const selectConversation = useCallback(
    async (conv: Conversation) => {
      setActiveId(conv.id);
      setMessages([]);
      await loadMessages(conv.id);
      useChatApi
        .markConversationRead(conv.id)
        .then(() => queryClient.invalidateQueries({ queryKey: CONV_KEY }))
        .catch(() => {});
    },
    [loadMessages, queryClient]
  );

  const loadMore = useCallback(async () => {
    if (!activeId || messages.length === 0) return;
    const oldest = messages[0];
    const res: any = await useChatApi.getMessages(
      activeId,
      oldest.createdAt,
      PAGE
    );
    const older = (res?.data ?? []) as ChatMessage[];
    setHasMore(older.length >= PAGE);
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      return [...older.filter((m) => !ids.has(m.id)), ...prev];
    });
  }, [activeId, messages]);

  const sendMessage = useCallback(async () => {
    const content = newMessage.trim();
    if (!content || !activeId || sending) return;
    setSending(true);
    setNewMessage("");
    try {
      const res: any = await useChatApi.sendMessage(activeId, content);
      if (res?.data) appendMessage(res.data as ChatMessage);
      queryClient.invalidateQueries({ queryKey: CONV_KEY });
    } catch {
      setNewMessage(content); // restore on failure
    } finally {
      setSending(false);
    }
  }, [newMessage, activeId, sending, appendMessage, queryClient]);

  const clearActive = useCallback(() => {
    setActiveId(null);
    setMessages([]);
  }, []);

  const startConversationWith = useCallback(
    async (userId: string) => {
      try {
        const res: any = await useChatApi.createDirectConversation(userId);
        const conv = res?.data as Conversation;
        if (!conv?.id) return;
        await queryClient.invalidateQueries({ queryKey: CONV_KEY });
        setActiveId(conv.id);
        setMessages([]);
        await loadMessages(conv.id);
      } catch (e: any) {
        toast.error(e?.message || "Couldn't start that conversation.");
      }
    },
    [queryClient, loadMessages]
  );

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  return {
    currentUserId,
    conversations,
    isLoadingConversations,
    activeId,
    activeConversation,
    messages,
    isLoadingMessages,
    hasMore,
    loadMore,
    newMessage,
    setNewMessage,
    sending,
    selectConversation,
    clearActive,
    sendMessage,
    startConversationWith,
    messagesEndRef,
  };
}
