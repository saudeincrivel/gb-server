import { ObjectId } from "mongodb";

export interface Post {
  _id?: ObjectId;
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  medias: Array<Media>;
  postal: number;
  published: boolean;
  views: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface Media {
  id: string;
  url: string;
  type: 'image' | 'video';
  s3Key: string;
  metadata: any;
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

export interface Campaign {
  _id?: ObjectId;
  id: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

// Collection names
export const COLLECTIONS = {
  POSTS: "posts",
  ADMIN: "admin",
  SUBSCRIPTIONS: "subscriptions",
  SOCIALS: "socials",
  EMAILS: "emails",
  CAMPAIGNS: "campaigns"
};
