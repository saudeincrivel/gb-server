import { Db } from "mongodb";
import { Logger } from "../../common/logs/logger";
import { COLLECTIONS } from "../../database/schemas";
import type { EventHandler } from "../types/event-handler";
import type { AdminConnectEvent } from "../types/schemas";

const logger = new Logger("AdminConnectHandler");

export class AdminConnectHandler implements EventHandler {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async handle(
    event: AdminConnectEvent
  ): Promise<{ success: boolean; token?: string; message?: string }> {
    logger.info("Admin connection attempt", { email: event.email });

    try {
      const admin = await this.db
        .collection(COLLECTIONS.ADMIN)
        .findOne({ email: event.email });

      if (!admin) {
        logger.warn("Admin not found", { email: event.email });
        return { success: false, message: "Invalid credentials" };
      }

      if (admin.password !== event.password) {
        logger.warn("Invalid password for admin", { email: event.email });
        return { success: false, message: "Invalid credentials" };
      }

      const token = this.generateToken();

      await this.db.collection(COLLECTIONS.ADMIN).updateOne(
        { email: event.email },
        {
          $set: {
            token,
            updatedAt: new Date(),
          },
        }
      );

      logger.info("Admin connected successfully", { email: event.email });
      return { success: true, token };
    } catch (error) {
      logger.error("Failed to connect admin", error);
      throw error;
    }
  }

  private generateToken(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
