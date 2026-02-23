import { z } from "zod";
import dotenv from "dotenv";

// Load .env file before anything else
dotenv.config();

// ─── Schema ───────────────────────────────────────────────
// Every env var this service needs is declared here.
// TypeScript infers the type of `env` from this schema automatically.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.string().default("3002").transform(Number),

  BASE_URL: z.string().default("http://localhost:80"),

  // PostgreSQL — required from PR-03 onwards
  DATABASE_URL: z.string().optional(),

  // Redis — required from PR-07 onwards
  REDIS_URL: z.string({ required_error: "REDIS_URL is required" }),
  CACHE_TTL_SECONDS: z.string().default("86400").transform(Number),

  // RabbitMQ — required from PR-14 onwards
  RABBITMQ_URL: z.string().optional(),
  RABBITMQ_QUEUE_CLICK_EVENTS: z.string().default("click_events"),
  RABBITMQ_PREFETCH_COUNT: z.string().default("10").transform(Number),

  // JWT — required from PR-12 onwards
  JWT_ACCESS_SECRET: z.string().optional(),

  // Rate Limiting — required from PR-19 onwards
  RATE_LIMIT_REDIRECT_RPM: z.string().default("300").transform(Number),
  RATE_LIMIT_API_RPM: z.string().default("60").transform(Number),
});

// ─── Infer Type ───────────────────────────────────────────
// TypeScript automatically knows the shape of env from the schema above.
// No need to manually write an interface — Zod generates it for us.
export type Env = z.infer<typeof envSchema>;

// ─── Parse & Validate ─────────────────────────────────────
const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(_parsed.error.flatten().fieldErrors);
  process.exit(1); // crash immediately — never start with bad config
}

const env: Env = _parsed.data;

export default env;
