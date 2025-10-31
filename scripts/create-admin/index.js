import { Db } from "mongodb";
import { getDatabase } from "../../src/database/mongo";

const db = await getDatabase();

const newAdmin = {
  email: "will@admin.com",
  password: "qualquerpass!$@fff",
  name: "Admin",
  createdAt: new Date(),
  updatedAt: new Date(),
}

async function main() {
  console.log("Creating admin...");
  const result = await db.collection("admin").insertOne(newAdmin);
  console.log("Admin created successfully", result);
}

main().catch(console.error);