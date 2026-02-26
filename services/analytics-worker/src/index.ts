import logger from "./config/logger";
import { connectMongoDB, disconnectMongoDB } from "./config/mongodb";
import { connectRabbitMQ, disconnectRabbitMQ } from "./config/rabbitmq";
import { startConsumer } from "./consumer/clickConsumer";

// ─── Bootstrap ────────────────────────────────────────────
const bootstrap = async (): Promise<void> => {
  // Connect to both dependencies in parallel
  await Promise.all([connectMongoDB(), connectRabbitMQ()]);

  // Start consuming click events from RabbitMQ
  // This runs indefinitely — worker processes messages as they arrive
  await startConsumer();

  logger.info("analytics-worker started — waiting for messages...");

  // ── Graceful Shutdown ────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);

    await Promise.all([disconnectMongoDB(), disconnectRabbitMQ()]);

    logger.info("analytics-worker shut down cleanly");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

bootstrap();
