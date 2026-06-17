import { Document } from 'mongoose';
import type { v4 as uuidv4 } from 'uuid';

export interface UserDocument extends Document {
  _id: string;
  serial: uuidv4;
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
  _id: string;
  serial: uuidv4;
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