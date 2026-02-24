import env from "./config/env";
import logger from "./config/logger";
import { connectDatabase } from "./config/database";
import { connectRedis } from "./config/redis";
import { connectRabbitMQ, disconnectRabbitMQ } from "./config/rabbitmq";
import app from "./app";

// ─── Bootstrap ────────────────────────────────────────────
// Connect to all dependencies first, then start HTTP server.
// All three connections run in parallel — faster startup.
const bootstrap = async (): Promise<void> => {
  await Promise.all([connectDatabase(), connectRedis(), connectRabbitMQ()]);

  const server = app.listen(env.PORT, () => {
    logger.info(`url-service running on port ${env.PORT}`, {
      env: env.NODE_ENV,
      port: env.PORT,
    });
  });

  // ─── Graceful Shutdown ──────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(async () => {
      // Disconnect RabbitMQ cleanly before exiting
      // so in-flight messages are not lost
      await disconnectRabbitMQ();
      logger.info("Server closed — process exiting");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

bootstrap();

export default app;
