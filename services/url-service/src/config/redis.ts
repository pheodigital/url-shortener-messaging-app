import Redis from "ioredis";
import logger from "./logger";
import env from "./env";

// ─── Redis Singleton ──────────────────────────────────────
// Same pattern as Prisma singleton — one shared connection
// across the entire service.
//
// ioredis automatically reconnects on disconnect so we
// don't need to handle reconnection logic manually.
// It also queues commands during reconnection so no
// commands are lost if Redis briefly goes down.

let redis: Redis | undefined;

const createRedisClient = (): Redis => {
  // console.upstash.com provides a Redis URL with SSL (rediss://) and built-in retry strategy.
  const client = new Redis(env.REDIS_URL as string, {
    // ─── Reconnection Strategy ─────────────────────────
    // Retry with exponential backoff up to 10 seconds
    // retryStrategy is called with the number of retries attempted
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error("Redis max retries reached — giving up");
        return null; // stop retrying
      }
      const delay = Math.min(times * 200, 10_000);
      logger.warn(`Redis retry attempt ${times} — waiting ${delay}ms`);
      return delay;
    },

    // ─── Connection Settings ───────────────────────────
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true, // don't connect until connectRedis() is called
  });

  // ─── Event Listeners ──────────────────────────────────
  client.on("connect", () => {
    logger.info("Redis connected successfully");
  });

  client.on("error", (error: Error) => {
    logger.error("Redis error", { error: error.message });
  });

  client.on("reconnecting", () => {
    logger.warn("Redis reconnecting...");
  });

  client.on("close", () => {
    logger.warn("Redis connection closed");
  });

  return client;
};

// ─── Connect ──────────────────────────────────────────────
// Called once on bootstrap in index.ts
// lazyConnect: true means the client doesn't attempt connection
// until this function is called
export const connectRedis = async (): Promise<void> => {
  try {
    redis = createRedisClient();
    await redis.connect();
  } catch (error) {
    logger.error("Redis connection failed", { error });
    process.exit(1); // cannot run without Redis — exit immediately
  }
};

// ─── Health Check ─────────────────────────────────────────
// Used by GET /health to verify Redis is still reachable
// Sends a PING command — Redis responds with PONG if healthy
// Returns "ok" or "error" — never throws
export const checkRedisHealth = async (): Promise<"ok" | "error"> => {
  try {
    const result = await redis?.ping();
    return result === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  }
};

// ─── Get Client ───────────────────────────────────────────
// Used by other modules (cache, rate limiter etc.) to get
// the shared Redis client instance
export const getRedis = (): Redis => {
  if (!redis) {
    throw new Error("Redis not initialised — call connectRedis() first");
  }
  return redis;
};
