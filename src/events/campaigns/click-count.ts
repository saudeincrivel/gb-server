import { Db } from "mongodb";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Campaign } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { ClickCountEvent } from "../types/schemas";

const logger = new Logger("ClickCountHandler");

export class ClickCountHandler implements EventHandler {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async handle(event: ClickCountEvent): Promise<{ success: boolean; count?: number }> {
    logger.info("Click count event received", { id: event.id });

    try {
      // Search for existing campaign document with the provided id
      const existingCampaign = await this.db
        .collection(COLLECTIONS.CAMPAIGNS)
        .findOne({ id: event.id });

      const now = new Date();

      if (existingCampaign) {
        // If document exists, increment the count field
        const result = await this.db
          .collection(COLLECTIONS.CAMPAIGNS)
          .updateOne(
            { id: event.id },
            { 
              $inc: { count: 1 },
              $set: { updatedAt: now }
            }
          );

        if (result.modifiedCount === 0) {
          logger.warn("Campaign document not updated", { id: event.id });
          throw new Error("Failed to update campaign count");
        }

        // Fetch updated document to return the new count
        const updatedCampaign = await this.db
          .collection(COLLECTIONS.CAMPAIGNS)
          .findOne({ id: event.id });

        logger.info("Campaign count incremented", { 
          id: event.id, 
          count: updatedCampaign?.count 
        });

        return { 
          success: true, 
          count: updatedCampaign?.count || existingCampaign.count + 1
        };
      } else {
        // If document doesn't exist, create a new one with count = 1
        const newCampaign: Campaign = {
          id: event.id,
          count: 1,
          createdAt: now,
          updatedAt: now,
        };

        await this.db.collection(COLLECTIONS.CAMPAIGNS).insertOne(newCampaign);

        logger.info("New campaign document created", { 
          id: event.id, 
          count: 1 
        });

        return { 
          success: true, 
          count: 1 
        };
      }
    } catch (error) {
      logger.error("Failed to handle click count event", error);
      throw error;
    }
  }
}

