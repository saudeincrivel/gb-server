import "dotenv/config";
import { Logger } from "./common/logs/logger";
import { getDatabase } from "./database/mongo";
import { EventHandlers } from "./events/index";
import { safeParseJson } from "./common/utils";
import { EventType } from "./events/types/event-type";
/// lambda v9

const logger = new Logger("lambda.index");

(async () => {
  try {
    const lambdaEvent = safeParseJson(
      Bun.env.AWS_LAMBDA_EVENT || "{}",
      {} as any
    );
    logger.info("Gb server Lambda started lambda event: v10 ", lambdaEvent);
    const db = await getDatabase();
    const factory = new EventHandlers(db);

    // Parse the body - it can be a string or already an object
    let event: { type: EventType } & Record<string, any>;
    if (typeof lambdaEvent.body === "string") {
      event = safeParseJson<{ type: EventType } & Record<string, any>>(
        lambdaEvent.body,
        {} as any
      );
    } else if (lambdaEvent.body && typeof lambdaEvent.body === "object") {
      event = lambdaEvent.body as { type: EventType } & Record<string, any>;
    } else {
      event = {} as any;
    }

    logger.info("Parsed event: ", event);

    if (!event || !event.type) {
      logger.error("Invalid event body - missing type", { lambdaEvent, event });
      throw new Error("Invalid event body - missing type");
    }

    // Verify the event type is valid
    if (!Object.values(EventType).includes(event.type)) {
      logger.error("Invalid event type", {
        eventType: event.type,
        lambdaEvent,
      });
      throw new Error(`Invalid event type: ${event.type}`);
    }

    logger.info("Processing event type: ", event.type);
    const response = await factory.handle(event.type, event);

    logger.info("Returning response to bun code: Response: ", response);

    const result = {
      statusCode: 200,
      body: JSON.stringify(response),
    };

    // Output the result as JSON to stdout (using process.stdout.write to ensure it's separate from logger output)
    // Use a clear delimiter so starter.js can extract it
    process.stdout.write("\n===BUN_RESULT_START===\n");
    process.stdout.write(JSON.stringify(result));
    process.stdout.write("\n===BUN_RESULT_END===\n");
    process.exit(0);
  } catch (error) {
    logger.error("Error: ", error);
    const errorResult = {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
    };
    // Output error result to stdout with delimiter
    process.stdout.write("\n===BUN_RESULT_START===\n");
    process.stdout.write(JSON.stringify(errorResult));
    process.stdout.write("\n===BUN_RESULT_END===\n");
    process.exit(1);
  }
})();
