export interface IMessage {
  id: string;
  sender: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  receiver?: string;
  groupId?: string;
  reports: string[];
}

export interface IUser {
  id: string;
  socketId: string;
  username: string;
  isOnline: boolean;
}

export interface IDisplayConversation {
  id: string;
  type: "user" | "group" | "global";
  name: string;
  avatar?: string;
  online?: boolean;
  lastMessage?: string;
  timestamp?: string;
  unread?: number;
}

export type Group = any;
