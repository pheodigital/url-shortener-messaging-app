import env from "./config/env";
import logger from "./config/logger";
import { connectDatabase } from "./config/database";
import { connectRedis } from "./config/redis";
import app from "./app";

const bootstrap = async (): Promise<void> => {
  await Promise.all([connectDatabase(), connectRedis()]);

  const server = app.listen(env.PORT, () => {
    logger.info(`url-service running on port ${env.PORT}`, {
      env: env.NODE_ENV,
      port: env.PORT,
    });
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
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
