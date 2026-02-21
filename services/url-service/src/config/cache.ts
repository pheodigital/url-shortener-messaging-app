import { getRedis } from "./redis";
import logger from "./logger";
import env from "./env";

// ─── Cache Key Prefix ─────────────────────────────────────
// All URL cache keys follow this pattern: url:{shortcode}
// Prefix prevents collision if we store other things in Redis later
const URL_PREFIX = "url";

const urlKey = (shortcode: string): string => `${URL_PREFIX}:${shortcode}`;

// ─── TTL Jitter ───────────────────────────────────────────
// Without jitter: all URLs cached at the same time expire together
// causing a thundering herd — hundreds of DB queries at once
//
// With jitter: add a small random offset (±10% of TTL)
// so expirations are spread naturally over time
//
// Example with CACHE_TTL_SECONDS=3600 (1 hour):
//   jitter range: ±360 seconds
//   actual TTLs:  3240s, 3600s, 3847s, 3412s...
//   instead of:  3600s, 3600s, 3600s, 3600s (all expire together)
const withJitter = (ttl: number): number => {
  const jitter = Math.floor(ttl * 0.1); // 10% of TTL
  const offset = Math.floor(Math.random() * (jitter * 2)) - jitter;
  return ttl + offset;
};

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
    // jittered TTL, expirations spread out
    const ttl = withJitter(env.CACHE_TTL_SECONDS);
    await redis.set(urlKey(shortcode), longUrl, "EX", ttl);

    logger.debug("Cache SET", { shortcode, ttl });
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

// ─── Warm Cache ───────────────────────────────────────────
// Pre-populates the cache immediately after a URL is created
// so the very first redirect request is a cache HIT not a MISS
//
// Without pre-warming:
//   POST /api/urls  → URL saved to DB, nothing in cache
//   GET /:shortcode → cache MISS → DB query → cached
//   GET /:shortcode → cache HIT  ✅ (only from second request)
//
// With pre-warming:
//   POST /api/urls  → URL saved to DB → immediately cached
//   GET /:shortcode → cache HIT ✅ (even on first request)
export const warmCache = async (
  shortcode: string,
  longUrl: string,
): Promise<void> => {
  // warmCache is just setCachedUrl with a descriptive name
  // to make intent clear at the call site in urlController
  await setCachedUrl(shortcode, longUrl);
  logger.debug("Cache WARMED", { shortcode });
};
