import { Db } from "mongodb";
import { createHash } from "crypto";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { Admin } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { AdminConnectEvent } from "../types/schemas";

const logger = new Logger("AdminConnectHandler");

export class AdminConnectHandler implements EventHandler {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async handle(event: AdminConnectEvent): Promise<{ success: boolean; token?: string; message?: string }> {
    logger.info("Admin connection attempt", { email: event.email });

    try {
      // Find admin by email
      const admin = await this.db.collection(COLLECTIONS.ADMIN).findOne({ email: event.email });

      if (!admin) {
        logger.warn("Admin not found", { email: event.email });
        return { success: false, message: "Invalid credentials" };
      }

      // Hash the provided password for comparison
      const hashedPassword = createHash('sha256').update(event.password).digest('hex');
      
      // Check if password matches
      if (admin.password !== hashedPassword) {
        logger.warn("Invalid password for admin", { email: event.email });
        return { success: false, message: "Invalid credentials" };
      }

      // Generate a new token
      const token = this.generateToken();
      
      // Update admin with new token
      await this.db.collection(COLLECTIONS.ADMIN).updateOne(
        { email: event.email },
        { 
          $set: { 
            token,
            updatedAt: new Date()
          } 
        }
      );
      
      logger.info("Admin connected successfully", { email: event.email });
      return { success: true, token };
    } catch (error) {
      logger.error("Failed to connect admin", error);
      throw error;
    }
  }

  // Generate a random token
  private generateToken(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
