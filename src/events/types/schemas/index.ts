// Base event interface
export interface BaseEvent {
  type: string;
}

// Post related event schemas
export interface PostCreateEvent extends BaseEvent {
  name: string;
  description?: string;
  tags?: string[];
  // For backward compatibility with existing posts
  images?: Array<{link: string; type: string; metadata: any}>;
  // New field for uploaded media files
  mediaFiles?: Array<{
    name: string;
    type: string;
    size: number;
    content: Buffer;
    metadata: any;
  }>;
  postal?: number;
  published?: boolean;
}

export interface PostUpdateEvent extends BaseEvent {
  id: string;
  name?: string;
  description?: string;
  tags?: string[];
  // For backward compatibility with existing posts
  images?: Array<{link: string; type: string; metadata: any}>;
  // New field for uploaded media files
  mediaFiles?: Array<{
    name: string;
    type: string;
    size: number;
    content: Buffer;
    metadata: any;
  }>;
  postal?: number;
  published?: boolean;
}

export interface PostGetEvent extends BaseEvent {
  id: string;
}

export interface PostsGetAllEvent extends BaseEvent {
  page?: number;
  limit?: number;
}

export interface PostsGetDeltaEvent extends BaseEvent {
  lastSyncDate: string; // ISO date string
}

export interface PostsGetFilteredEvent extends BaseEvent {
  tags?: string[];
  published?: boolean;
  page?: number;
  limit?: number;
}

// Admin related event schemas
export interface AdminConnectEvent extends BaseEvent {
  email: string;
  password: string;
}

// Newsletter related event schemas
export interface NewsletterSubscribeEvent extends BaseEvent {
  email: string;
  name?: string;
}

// Campaign related event schemas
export interface ClickCountEvent extends BaseEvent {
  id: string;
}
