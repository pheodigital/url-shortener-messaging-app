import { PrismaClient } from "@prisma/client";
import logger from "./logger";
import env from "./env";

// ─── Prisma Singleton ─────────────────────────────────────
// Why singleton?
// Prisma manages a connection pool internally.
// If you do `new PrismaClient()` on every request you'd open
// hundreds of connections and exhaust PostgreSQL's limit (~100).
// One shared instance = one pool = efficient and safe.

// In development, Next.js / tsx hot reload can create multiple
// instances. The global trick prevents that.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"] // log all queries in dev
        : ["warn", "error"], // only warnings/errors in prod
  });

if (env.NODE_ENV !== "production") {
  // Store on global so hot reload doesn't create new instances
  global.__prisma = prisma;
}

// ─── Connection Check ─────────────────────────────────────
// Call this on startup to verify DB is reachable.
// Fails fast if DATABASE_URL is wrong or PostgreSQL is down.
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully", {
      database: "postgresql",
    });
  } catch (error) {
    logger.error("Database connection failed", { error });
    process.exit(1); // cannot run without a DB — exit immediately
  }
};

// ─── Health Check ─────────────────────────────────────────
// Used by GET /health to verify DB is still reachable.
// Returns "ok" or "error" — never throws.
export const checkDatabaseHealth = async (): Promise<"ok" | "error"> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
};

export default prisma;
