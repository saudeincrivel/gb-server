import { Db } from "mongodb";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Post } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { PostGetEvent } from "../types/schemas";

const logger = new Logger("PostGetHandler");

export class PostGetHandler implements EventHandler {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async handle(event: PostGetEvent): Promise<{ success: boolean; post: Post | null }> {
    logger.info("Getting post", { id: event.id });

    try {
      const post = await this.db.collection(COLLECTIONS.POSTS).findOne({ id: event.id });

      if (!post) {
        logger.warn("Post not found", { id: event.id });
        return { success: false, post: null };
      }

      // Increment view count
      await this.db.collection(COLLECTIONS.POSTS).updateOne(
        { id: event.id },
        { $inc: { views: 1 } }
      );
      
      // Update the view count in the returned post
      post.views += 1;
      
      logger.info("Post retrieved successfully", { id: event.id });
      return { success: true, post };
    } catch (error) {
      logger.error("Failed to get post", error);
      throw error;
    }
  }
}
