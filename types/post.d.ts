import { Document, Types } from 'mongoose';
import { UserDocument } from './user.d';

export interface Post {
  serial: string;
  image: string[];
  likes: UserDocument[];
  caption: string;
  location: string;
  owner: UserDocument;
  comments: Comment[];
  hashtags: string[];
  postType: 'POST' | 'JOURNAL';
  fromGroup: Types.ObjectId;
}

export interface PostDocument extends Post, Document {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPostProps {
  __v: number;
  _id: string;
  caption: string;
  comments: Array<{
    _id: string;
    content: string;
    owner: {
      _id: string;
      username: string;
    };
    createdAt: string;
  }>;
  createdAt: string;
  image: string[];
  likes: Array<{
    _id: string;
    fullName: string;
    username: string;
  }>;
  location: string;
  fromGroup?: {
    _id: string;
    serial: string;
    name: string;
  }
  owner?: {
    _id: string;
    fullName: string;
    username: string;
    profileImage?: string;
  };
  serial: string;
  updatedAt: string;
  fromGroup?: string;
}