import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import "express-async-errors";

import { notFound, errorHandler } from "./middleware/errorHandler";
import healthRoutes from "./routes/v1/healthRoutes";
import urlRoutes from "./routes/v1/urlRoutes";

const app: Application = express();

// ─── Security Middleware ──────────────────────────────────
app.use(helmet());
app.use(cors());

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
app.use("/api/urls", urlRoutes);

// PR-05 → redirectRoutes (GET /:shortcode) added next

// ─── Error Handling ───────────────────────────────────────
// Must be registered AFTER all routes
app.use(notFound);
app.use(errorHandler);

export default app;
