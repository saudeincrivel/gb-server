import { Logger } from "../../common/logs/logger";
import { MongoClient, type Db } from "mongodb";

const logger = new Logger("database.mongo.index");

let mongoClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export const getDatabase = async (): Promise<Db> => {
  if (cachedDb) {
    return cachedDb;
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(Bun.env.MONGODB_URI!);
  }

  await mongoClient.connect();

  cachedDb = mongoClient.db(Bun.env.MONGODB!);

  if (!cachedDb) {
    throw new Error("Failed to initialize MongoDB database instance");
  }

  return cachedDb;
};
