"use client";

/**
 * Realtime hook — socket.io-compatible surface, backed by Supabase Realtime.
 *
 * Keeps the exact API the components already use (.on/.off/.emit/.connected/.disconnect/.id) so no
 * consumer changes. Live behavior wired today:
 *   - "connect"            -> fires once the session resolves (sets isConnected in callers)
 *   - "newNotification"    -> Supabase Realtime INSERT on notifications for the current user
 *   - emit("findUserNotification", userId, ack) -> bootstraps the list from GET /api/notifications
 * Chat events (privateMessage, getOnlineUsers, …) are accepted but inert — that's Phase 2; the old
 * pulse server that implemented them is gone.
 */
import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";

export const ACCESS_TOKEN_LOCAL_STORAGE_KEY = "ACCESS_TOKEN";
export const API_BASE_URL = process.env["NEXT_PUBLIC_API_BASE_URL"];

export interface SocketLike {
  id: string;
  connected: boolean;
  on(event: string, cb: (...args: any[]) => void): void;
  off(event: string, cb?: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  disconnect(): void;
}

type Handler = (...args: any[]) => void;

function mapNotif(r: any) {
  return {
    id: r.id,
    type: r.type,
    targetType: r.target_type,
    targetId: r.target_id,
    message: r.message,
    read: r.read,
    createdAt: r.created_at,
    readAt: r.read_at,
    actor: r.actor_id ? { id: r.actor_id } : undefined,
  };
}

class RealtimeShim implements SocketLike {
  id = Math.random().toString(36).slice(2);
  connected = false;
  private supabase = createClient();
  private handlers = new Map<string, Set<Handler>>();
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;
    const { data } = await this.supabase.auth.getUser();
    this.userId = data.user?.id ?? null;
    this.connected = true;
    this.fire("connect");
    this.ensureNotificationChannel();
  }

  private ensureNotificationChannel() {
    if (this.channel || !this.userId || !this.handlers.has("newNotification")) return;
    this.channel = this.supabase
      .channel(`notif:${this.userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${this.userId}`,
        },
        (payload) => this.fire("newNotification", mapNotif(payload.new))
      )
      .subscribe();
  }

  private fire(event: string, ...args: any[]) {
    this.handlers.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (e) {
        console.error(`socket handler error for "${event}":`, e);
      }
    });
  }

  on(event: string, cb: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(cb);
    if (event === "connect" && this.connected) cb();
    if (event === "newNotification") this.ensureNotificationChannel();
  }

  off(event: string, cb?: Handler) {
    if (!cb) this.handlers.delete(event);
    else this.handlers.get(event)?.delete(cb);
  }

  emit(event: string, ...args: any[]) {
    // Notification center bootstraps its list via this ack pattern.
    if (event === "findUserNotification") {
      const ack = args[args.length - 1];
      if (typeof ack === "function") {
        fetch("/api/notifications")
          .then((r) => r.json())
          .then((j) => ack(j?.data ?? []))
          .catch(() => ack([]));
      }
      return;
    }
    // Other emits (chat, createNotification) are no-ops: notifications are now created server-side
    // (toggle_like/follow, comment) and chat is Phase 2.
  }

  disconnect() {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.connected = false;
  }
}

export const useWebsocket = (_opts: {
  path?: string;
  shouldAuthenticate?: boolean;
  autoConnect?: boolean;
}): SocketLike => {
  const ref = useRef<RealtimeShim | null>(null);
  if (!ref.current) ref.current = new RealtimeShim();

  useEffect(() => {
    const shim = ref.current!;
    shim.start();
    return () => shim.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref.current;
};
