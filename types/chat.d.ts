// Chat types for the direct-message feature (Supabase-backed).

export interface ChatUser {
  id: string;
  username: string;
  fullName: string;
  profileImage?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  attachments?: any[];
  deleted?: boolean;
  editedAt?: string | null;
  createdAt: string;
  sender?: ChatUser;
}

export interface ConversationLastMessage {
  id: string;
  content: string | null;
  senderId: string;
  createdAt: string;
  deleted?: boolean;
}

export interface Conversation {
  id: string;
  serial?: string;
  type: "DIRECT" | "GROUP";
  name?: string | null;
  coverImage?: string | null;
  otherUser: ChatUser | null;
  members?: ChatUser[];
  lastMessage: ConversationLastMessage | null;
  lastMessageAt?: string | null;
  unread: boolean;
}
