import { Db } from "mongodb";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Post } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { PostsGetAllEvent } from "../types/schemas";

const logger = new Logger("PostsGetAllHandler");

export class PostsGetAllHandler implements EventHandler {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async handle(event: PostsGetAllEvent): Promise<{ success: boolean; posts: Post[]; total: number; page: number; limit: number }> {
    const page = event.page || 1;
    const limit = event.limit || 10;
    const skip = (page - 1) * limit;

    logger.info("Getting all posts", { page, limit });

    try {
      const [posts, total] = await Promise.all([
        this.db.collection(COLLECTIONS.POSTS)
          .find({ published: true })
          .sort({ publishedAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        this.db.collection(COLLECTIONS.POSTS).countDocuments({ published: true })
      ]);
      
      logger.info("Posts retrieved successfully", { count: posts.length, total });
      return { 
        success: true, 
        posts: posts as Post[], 
        total, 
        page, 
        limit 
      };
    } catch (error) {
      logger.error("Failed to get posts", error);
      throw error;
    }
  }
}
