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
  /**
   * feed_genres.md §5.1 — the genre. MOMENT (photo-led, the old 'POST'
   * vocabulary), JOURNAL (long-form photo-led), POST (title-led text
   * discussion, may have no image at all). Optional/loose for backward
   * compatibility with rows written before the genre split.
   */
  postType: 'MOMENT' | 'POST' | 'JOURNAL';
  /** Present (and required) only for the POST genre — §5.2. */
  title?: string | null;
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
    edited?: boolean;
    owner: {
      id: string;
      username: string;
      profileImage?: string;
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
  /**
   * feed_genres.md §5.1/§5.2 — genre + the Post-only fields the RPC JSON
   * builders now emit (`build_post_json`, `feed_post_slim`). Optional so every
   * pre-genre-split payload (and every fixture) still type-checks unchanged.
   */
  postType?: 'MOMENT' | 'POST' | 'JOURNAL';
  /** Non-null only for the POST genre. */
  title?: string | null;
  upvoteCount?: number;
  downvoteCount?: number;
  /** Generated column: upvoteCount - downvoteCount. */
  score?: number;
  /** Denormalized counter; the `comments` array may be bounded or absent. */
  commentCount?: number;
  fromGroup?:
    | string
    | {
        id: string;
        serial: string;
        name: string;
      };
}
