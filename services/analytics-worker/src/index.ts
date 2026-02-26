import logger from "./config/logger";
import { connectMongoDB, disconnectMongoDB } from "./config/mongodb";
import { connectRabbitMQ, disconnectRabbitMQ } from "./config/rabbitmq";

// ─── Bootstrap ────────────────────────────────────────────
// No HTTP server — this is a background worker.
// Connects to MongoDB and RabbitMQ then starts consuming.
//
// Flow:
//   1. Connect to MongoDB (stores click events)
//   2. Connect to RabbitMQ (reads click_events queue)
//   3. Start consumer loop (PR-17)
const bootstrap = async (): Promise<void> => {
  // Connect to both dependencies in parallel
  await Promise.all([connectMongoDB(), connectRabbitMQ()]);

  logger.info("analytics-worker started — waiting for messages...");

  // ── Start consumer ───────────────────────────────────────
  // Stub — actual consumer implemented in PR-17
  // startConsumer() will be imported and called here
  // import { startConsumer } from "./consumer/clickConsumer";
  // await startConsumer();

  // ── Graceful Shutdown ────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);

    // Disconnect cleanly so in-flight messages are not lost
    await Promise.all([disconnectMongoDB(), disconnectRabbitMQ()]);

    logger.info("analytics-worker shut down cleanly");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

bootstrap();
