import { Db } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Subscription, Email } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { NewsletterSubscribeEvent } from "../types/schemas";

const logger = new Logger("NewsletterSubscribeHandler");

export class NewsletterSubscribeHandler implements EventHandler {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async handle(event: NewsletterSubscribeEvent): Promise<{ success: boolean; message: string }> {
    logger.info("Newsletter subscription request", { email: event.email });

    try {
      // Check if email is already subscribed
      const existingSubscription = await this.db.collection(COLLECTIONS.SUBSCRIPTIONS)
        .findOne({ email: event.email });

      if (existingSubscription) {
        logger.info("Email already subscribed", { email: event.email });
        return { success: true, message: "You are already subscribed to our newsletter" };
      }

      const now = new Date();
      
      // Create subscription
      const subscription: Subscription = {
        id: uuidv4(),
        email: event.email,
        createdAt: now
      };

      await this.db.collection(COLLECTIONS.SUBSCRIPTIONS).insertOne(subscription);
      
      // Also store in emails collection if not exists
      const existingEmail = await this.db.collection(COLLECTIONS.EMAILS)
        .findOne({ email: event.email });
        
      if (!existingEmail) {
        const emailDoc: Email = {
          email: event.email,
          name: event.name,
          createdAt: now
        };
        
        await this.db.collection(COLLECTIONS.EMAILS).insertOne(emailDoc);
      } else if (event.name && !existingEmail.name) {
        // Update name if it wasn't set before
        await this.db.collection(COLLECTIONS.EMAILS)
          .updateOne(
            { email: event.email },
            { $set: { name: event.name } }
          );
      }
      
      logger.info("Newsletter subscription successful", { email: event.email });
      return { 
        success: true, 
        message: "You have been successfully subscribed to our newsletter" 
      };
    } catch (error) {
      logger.error("Failed to subscribe to newsletter", error);
      throw error;
    }
  }
}
