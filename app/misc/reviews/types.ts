export interface ReviewDocument {
  id: string;
  serial: string;
  user: {
    id: string;
    fullName: string;
    username: string;
    email: string;
    profileImage?: string;
  };
  type: "REVIEW" | "BUG_REPORT";
  scope:
    | "FEED"
    | "CHAT"
    | "SEARCH"
    | "PROFILE"
    | "USER_INTERFACE"
    | "USER_EXPERIENCE"
    | "AI"
    | "PERFORMANCE"
    | "CONTENT"
    | "OTHER";
  status: "PENDING" | "APPROVED" | "REJECTED";
  review?: string;
  title?: string;
  description?: string;
  media?: {
    id: string;
    url: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewCardProps {
  review: ReviewDocument;
}
