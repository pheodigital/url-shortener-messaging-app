import env from "./config/env";
import logger from "./config/logger";
import { connectMongoDB, disconnectMongoDB } from "./config/mongodb";
import app from "./app";

// ─── Bootstrap ────────────────────────────────────────────
const bootstrap = async (): Promise<void> => {
  await connectMongoDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`analytics-service running on port ${env.PORT}`, {
      env: env.NODE_ENV,
      port: env.PORT,
    });
  });

  // ─── Graceful Shutdown ──────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectMongoDB();
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
