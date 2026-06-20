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
  fromGroup: string;
}

export interface PostDocument extends Post {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPostProps {
  __v: number;
  id: string;
  caption: string;
  comments: Array<{
    id: string;
    content: string;
    owner: {
      id: string;
      username: string;
    };
    createdAt: string;
  }>;
  createdAt: string;
  image: string[];
  likes: Array<{
    id: string;
    fullName: string;
    username: string;
  }>;
  location: string;
  owner?: {
    id: string;
    fullName: string;
    username: string;
    profileImage?: string;
  };
  serial: string;
  updatedAt: string;
  fromGroup?:
    | string
    | {
        id: string;
        serial: string;
        name: string;
      };
}
