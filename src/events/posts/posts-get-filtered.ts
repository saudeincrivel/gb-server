import { Db } from "mongodb";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Post } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { PostsGetFilteredEvent } from "../types/schemas";

const logger = new Logger("PostsGetFilteredHandler");

export class PostsGetFilteredHandler implements EventHandler {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async handle(event: PostsGetFilteredEvent): Promise<{ success: boolean; posts: Post[]; total: number; page: number; limit: number }> {
    const page = event.page || 1;
    const limit = event.limit || 10;
    const skip = (page - 1) * limit;
    
    logger.info("Getting filtered posts", { filters: event });

    try {
      // Build query based on provided filters
      const query: Record<string, any> = {};
      
      // Always filter for published posts unless explicitly specified
      if (event.published !== undefined) {
        query.published = event.published;
      } else {
        query.published = true;
      }
      
      // Filter by tags if provided
      if (event.tags && event.tags.length > 0) {
        query.tags = { $in: event.tags };
      }

      const [posts, total] = await Promise.all([
        this.db.collection(COLLECTIONS.POSTS)
          .find(query)
          .sort({ publishedAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        this.db.collection(COLLECTIONS.POSTS).countDocuments(query)
      ]);
      
      logger.info("Filtered posts retrieved successfully", { count: posts.length, total });
      return { 
        success: true, 
        posts: posts as Post[], 
        total, 
        page, 
        limit 
      };
    } catch (error) {
      logger.error("Failed to get filtered posts", error);
      throw error;
    }
  }
}
