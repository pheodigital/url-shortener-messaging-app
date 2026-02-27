import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3003),

  // MongoDB — same cluster as analytics-worker
  // analytics-service only reads, never writes
  MONGODB_URI: z.string({ required_error: "MONGODB_URI is required" }),

  // JWT — same secret as auth-service and url-service
  // Used to verify access tokens on protected endpoints
  JWT_ACCESS_SECRET: z
    .string({ required_error: "JWT_ACCESS_SECRET is required" })
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),

  // CORS
  ALLOWED_ORIGIN: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export default env;
