import { Db } from "mongodb";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Post } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { PostsGetDeltaEvent } from "../types/schemas";

const logger = new Logger("PostsGetDeltaHandler");

export class PostsGetDeltaHandler implements EventHandler {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async handle(event: PostsGetDeltaEvent): Promise<{ success: boolean; posts: Post[] }> {
    const lastSyncDate = new Date(event.lastSyncDate);
    
    logger.info("Getting posts delta", { lastSyncDate });

    try {
      // Get all posts that were created or updated after the last sync date
      const posts = await this.db.collection(COLLECTIONS.POSTS)
        .find({
          $and: [
            { published: true },
            { 
              $or: [
                { updatedAt: { $gt: lastSyncDate } },
                { createdAt: { $gt: lastSyncDate } }
              ] 
            }
          ]
        })
        .sort({ updatedAt: -1 })
        .toArray();
      
      logger.info("Posts delta retrieved successfully", { count: posts.length });
      return { 
        success: true, 
        posts: posts as Post[]
      };
    } catch (error) {
      logger.error("Failed to get posts delta", error);
      throw error;
    }
  }
}
