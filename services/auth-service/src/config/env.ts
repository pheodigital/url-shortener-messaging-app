import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// ─── Env Schema ───────────────────────────────────────────
// Validates ALL environment variables on startup.
// Server refuses to start if any required var is missing.
const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3001),

  // Database
  DATABASE_URL: z.string({ required_error: "DATABASE_URL is required" }),

  // JWT
  JWT_SECRET: z
    .string({ required_error: "JWT_SECRET is required" })
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // Google OAuth2
  GOOGLE_CLIENT_ID: z.string({
    required_error: "GOOGLE_CLIENT_ID is required",
  }),
  GOOGLE_CLIENT_SECRET: z.string({
    required_error: "GOOGLE_CLIENT_SECRET is required",
  }),
  GOOGLE_CALLBACK_URL: z.string({
    required_error: "GOOGLE_CALLBACK_URL is required",
  }),

  // CORS
  ALLOWED_ORIGIN: z.string().default("http://localhost:3000"),
});

// ─── Parse and Export ─────────────────────────────────────
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export default env;
