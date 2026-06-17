export interface PersonPageProps {
  personId: string;
  selfProfile: boolean;
}

export interface IPost {
  _id: string;
  image: string[];
  likes: Array<{
    _id: string;
    fullName: string;
    username: string;
  }>;
  caption: string;
  location: string;
  owner: string;
  comments: Array<{
    _id: string;
    content: string;
    owner: {
      _id: string;
      username: string;
    };
    createdAt: string;
  }>;
  serial: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}
