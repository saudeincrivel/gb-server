import { Db } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Post } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { PostCreateEvent } from "../types/schemas";

const logger = new Logger("PostCreateHandler");

export class PostCreateHandler implements EventHandler {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async handle(event: PostCreateEvent): Promise<{ success: boolean; post: Post }> {
    logger.info("Creating new post", { name: event.name });

    try {
      const now = new Date();
      const post: Post = {
        id: uuidv4(),
        name: event.name,
        description: event.description || "",
        tags: event.tags || [],
        links: event.links || [],
        images: event.images,
        postal: event.postal || 0,
        published: event.published || false,
        views: 0,
        createdAt: now,
        updatedAt: now,
      };

      if (post.published) {
        post.publishedAt = now;
      }

      await this.db.collection(COLLECTIONS.POSTS).insertOne(post);
      
      logger.info("Post created successfully", { id: post.id });
      return { success: true, post };
    } catch (error) {
      logger.error("Failed to create post", error);
      throw error;
    }
  }
}
