import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // MongoDB — stores click events
  MONGODB_URI: z.string({ required_error: "MONGODB_URI is required" }),

  // RabbitMQ — consumes click_events queue published by url-service
  RABBITMQ_URL: z.string({ required_error: "RABBITMQ_URL is required" }),
  RABBITMQ_QUEUE_CLICK_EVENTS: z.string().default("click_events"),

  // Consumer settings
  // prefetch limits how many unacknowledged messages are in flight
  // at once — prevents worker from being overwhelmed
  RABBITMQ_PREFETCH_COUNT: z.coerce.number().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export default env;
