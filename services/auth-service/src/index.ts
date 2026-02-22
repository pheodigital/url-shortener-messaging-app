import env from "./config/env";
import logger from "./config/logger";
import { connectDatabase } from "./config/database";
import app from "./app";

// ─── Bootstrap ────────────────────────────────────────────
const bootstrap = async (): Promise<void> => {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info(`auth-service running on port ${env.PORT}`, {
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

  process.on("SIGTERM", () => shutdown("SIGTERM")); // Kubernetes sends SIGTERM before killing the container
  process.on("SIGINT", () => shutdown("SIGINT")); // SIGINT is sent when you press Ctrl+C in the terminal
};

bootstrap();
