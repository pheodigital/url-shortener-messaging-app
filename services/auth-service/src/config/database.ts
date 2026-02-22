import { PrismaClient } from "@prisma/client";
import logger from "./logger";
import env from "./env";

// ─── Prisma Singleton ─────────────────────────────────────
// Shared with url-service — same PostgreSQL database
// auth-service reads/writes the users table
// url-service reads/writes the urls table
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
  });

if (env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

// ─── Connection Check ─────────────────────────────────────
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully", {
      database: "postgresql",
    });
  } catch (error) {
    logger.error("Database connection failed", { error });
    process.exit(1);
  }
};

// ─── Health Check ─────────────────────────────────────────
export const checkDatabaseHealth = async (): Promise<"ok" | "error"> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
};

export default prisma;
