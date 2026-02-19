// ─── Env must be imported first ───────────────────────────
// Validates all env vars before anything else loads.
// If validation fails, process.exit(1) is called immediately.
import env from "./config/env";
import logger from "./config/logger";

import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";

// Patches Express so async errors auto-call next(err)
// Must be imported after express
import "express-async-errors";

import { notFound, errorHandler } from "./middleware/errorHandler";
import healthRoutes from "./routes/v1/healthroutes";

// ─── Create App ───────────────────────────────────────────
const app: Application = express();

// ─── Security Middleware ──────────────────────────────────
app.use(helmet());
app.use(cors());

// ─── Body Parsing ─────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Request Logger ───────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
  next();
});

// ─── Routes ───────────────────────────────────────────────
app.use(healthRoutes);

// NOTE: Routes added in future PRs:
// PR-04 → urlRoutes      (POST /api/urls, GET /api/urls, DELETE /api/urls/:id)
// PR-05 → redirectRoutes (GET /:shortcode)

// ─── Error Handling ───────────────────────────────────────
// Must be registered AFTER all routes
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────
const server = app.listen(env.PORT, () => {
  logger.info(`url-service running on port ${env.PORT}`, {
    env: env.NODE_ENV,
    port: env.PORT,
  });
});

// ─── Graceful Shutdown ────────────────────────────────────
// Docker and Kubernetes send SIGTERM when stopping a container.
// We catch it, allow in-flight requests to finish, then exit cleanly.
const shutdown = (signal: string): void => {
  logger.info(`${signal} received — shutting down gracefully`);

  server.close(() => {
    logger.info("Server closed — process exiting");
    process.exit(0);
  });

  // Force exit if server hasn't closed within 10 seconds
  setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ─── Export for Tests ─────────────────────────────────────
export default app;
