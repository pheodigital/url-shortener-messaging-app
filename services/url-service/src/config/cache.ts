import { getRedis } from "./redis";
import logger from "./logger";
import env from "./env";

// ─── Cache Key Prefix ─────────────────────────────────────
// All URL cache keys follow this pattern: url:{shortcode}
// Prefix prevents collision if we store other things in Redis later
const URL_PREFIX = "url";

const urlKey = (shortcode: string): string => `${URL_PREFIX}:${shortcode}`;

// ─── Get Cached URL ───────────────────────────────────────
// Returns the longUrl string if cached, null if not found
// Called first on every redirect request (hot path)
export const getCachedUrl = async (
  shortcode: string,
): Promise<string | null> => {
  try {
    const redis = getRedis();
    const cached = await redis.get(urlKey(shortcode));

    if (cached) {
      logger.debug("Cache HIT", { shortcode });
    } else {
      logger.debug("Cache MISS", { shortcode });
    }

    return cached;
  } catch (error) {
    // Never crash the redirect on a cache error
    // Fail open — fall through to DB query
    logger.error("Cache get error", { shortcode, error });
    return null;
  }
};

// ─── Cache URL ────────────────────────────────────────────
// Stores the longUrl in Redis with a TTL
// Called after a successful DB lookup (cache MISS path)
export const setCachedUrl = async (
  shortcode: string,
  longUrl: string,
): Promise<void> => {
  try {
    const redis = getRedis();

    // EX sets expiry in seconds
    // After TTL expires Redis automatically removes the key
    await redis.set(urlKey(shortcode), longUrl, "EX", env.CACHE_TTL_SECONDS);

    logger.debug("Cache SET", { shortcode, ttl: env.CACHE_TTL_SECONDS });
  } catch (error) {
    // Never crash on cache write failure
    // The redirect already happened — this is best effort
    logger.error("Cache set error", { shortcode, error });
  }
};

// ─── Invalidate Cache ─────────────────────────────────────
// Deletes the cache key when a URL is soft deleted
// Prevents stale cache serving redirects for deleted URLs
// Called from deleteUrl controller (PR-08)
export const invalidateCachedUrl = async (shortcode: string): Promise<void> => {
  try {
    const redis = getRedis();
    await redis.del(urlKey(shortcode));

    logger.debug("Cache INVALIDATED", { shortcode });
  } catch (error) {
    // Log but don't crash — the DB soft delete already happened
    logger.error("Cache invalidation error", { shortcode, error });
  }
};
