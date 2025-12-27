import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DB URL not set");
}

const prisma = new PrismaClient();

export { prisma };
