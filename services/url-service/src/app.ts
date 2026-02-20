import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import "express-async-errors";

import { notFound, errorHandler } from "./middleware/errorHandler";
import healthRoutes from "./routes/v1/healthRoutes";
import urlRoutes from "./routes/v1/urlRoutes";
import redirectRoutes from "./routes/v1/redirectRoutes"; // ← this line must be here

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
app.use(redirectRoutes); // ← this line must be here

// ─── Error Handling ───────────────────────────────────────
// Must be registered AFTER all routes
app.use(notFound);
app.use(errorHandler);

export default app;
