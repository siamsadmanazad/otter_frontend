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
  profile: {
    postsCount: number;
    commentsCount: number;
    followersCount: number;
    followingCount: number;
    createdAt: Date;
    updatedAt: Date;
  };
}
