import { ObjectId } from "mongodb";

export interface Post {
  _id?: ObjectId;
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  links?: Array<{link: string; type: string; metadata: any}>;
  images: Array<{link: string; type: string; metadata: any}>;
  postal: number;
  published: boolean;
  views: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface Admin {
  _id?: ObjectId;
  name: string;
  email: string;
  password: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  _id?: ObjectId;
  id: string;
  email: string;
  createdAt: Date;
}

export interface Social {
  _id?: ObjectId;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  github?: string;
  youtube?: string;
  updatedAt: Date;
}

export interface Email {
  _id?: ObjectId;
  email: string;
  name?: string;
  createdAt: Date;
}

// Collection names
export const COLLECTIONS = {
  POSTS: "posts",
  ADMIN: "admin",
  SUBSCRIPTIONS: "subscriptions",
  SOCIALS: "socials",
  EMAILS: "emails"
};
