import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import "express-async-errors";

import env from "./config/env";
import { notFound, errorHandler } from "./middleware/errorHandler";
import healthRoutes from "./routes/v1/healthRoutes";

const app: Application = express();

// ─── Security Middleware ──────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.ALLOWED_ORIGIN,
    credentials: true, // needed for cookies (JWT in httpOnly cookie)
  }),
);

// ─── Body Parsing ─────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Request Logger ───────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const logger = require("./config/logger").default;
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
  next();
});

// ─── Routes ───────────────────────────────────────────────
app.use(healthRoutes);

// PR-11 → Google OAuth routes (/auth/google, /auth/google/callback)
// PR-12 → JWT routes (/auth/me, /auth/refresh, /auth/logout)

// ─── Error Handling ───────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
