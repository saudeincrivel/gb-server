import { Db } from "mongodb";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Post } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { PostUpdateEvent } from "../types/schemas";

const logger = new Logger("PostUpdateHandler");

export class PostUpdateHandler implements EventHandler {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async handle(event: PostUpdateEvent): Promise<{ success: boolean; post: Post | null }> {
    logger.info("Updating post", { id: event.id });

    try {
      const now = new Date();
      const updateData: Partial<Post> = {
        updatedAt: now,
      };

      // Add fields to update only if they are provided
      if (event.name !== undefined) updateData.name = event.name;
      if (event.description !== undefined) updateData.description = event.description;
      if (event.tags !== undefined) updateData.tags = event.tags;
      if (event.links !== undefined) updateData.links = event.links;
      if (event.images !== undefined) updateData.images = event.images;
      if (event.postal !== undefined) updateData.postal = event.postal;
      
      // Handle published status change
      if (event.published !== undefined) {
        updateData.published = event.published;
        
        // If post is being published for the first time, set publishedAt
        if (event.published) {
          const existingPost = await this.db.collection(COLLECTIONS.POSTS).findOne({ id: event.id });
          if (existingPost && !existingPost.published) {
            updateData.publishedAt = now;
          }
        }
      }

      const result = await this.db.collection(COLLECTIONS.POSTS).findOneAndUpdate(
        { id: event.id },
        { $set: updateData },
        { returnDocument: "after" }
      );

      if (!result) {
        logger.warn("Post not found for update", { id: event.id });
        return { success: false, post: null };
      }
      
      logger.info("Post updated successfully", { id: event.id });
      return { success: true, post: result };
    } catch (error) {
      logger.error("Failed to update post", error);
      throw error;
    }
  }
}
