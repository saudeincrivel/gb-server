import "dotenv/config";
import { Logger } from "./common/logs/logger";
import { getDatabase } from "./database/mongo";
import { EventHandlers } from "./events";

const logger = new Logger("lambda.index");

(async () => {
  const lambdaEvent = JSON.parse(Bun.env.AWS_LAMBDA_EVENT || "{}");
  logger.info("Gb server Lambda started lambda event: ", lambdaEvent);

  try {
    const db = await getDatabase();
    const factory = new EventHandlers(db);
    const response = await factory.handle(lambdaEvent.body);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error("Error: ", error);
    throw error;
  }
})();
