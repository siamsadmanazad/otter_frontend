export interface UserDocument {
  id: string;
  serial: string;
  bio: string;
  location: string;
  fullName: string;
  username: string;
  email: string;
  password: string;
  agreeToTerms: boolean;
  socials: {
    platform: string;
    url: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
  reputation: number;
  coverImage: string;
  profileImage: string;
  role: "USER" | "BUSINESS";
}

export interface IUserProfile {
  id: string;
  serial: string;
  bio: string;
  location: string;
  fullName: string;
  username: string;
  email: string;
  password: string;
  agreeToTerms: boolean;
  socials: {
    platform: string;
    url: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
  reputation: number;
  coverImage: string;
  profileImage: string;
  role: "USER" | "BUSINESS";
  verified?: boolean;
  stats?: {
    totalLikes?: number;
    avgLikes?: number;
    engagement?: number;
  };
  profile: {
    id?: string;
    postsCount: number;
    commentsCount: number;
    followersCount: number;
    followingCount: number;
    createdAt: Date;
    updatedAt: Date;
    // Legacy populated arrays — the rebuilt API returns counts, not arrays, so
    // these are optional and may be absent at runtime (reads guard accordingly).
    posts?: any[];
    followers?: any[];
    following?: any[];
  };
}
