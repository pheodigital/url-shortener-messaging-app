import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import "express-async-errors";

import env from "./config/env";
import { notFound, errorHandler } from "./middleware/errorHandler";
import healthRoutes from "./routes/v1/healthRoutes";
import statsRoutes from "./routes/v1/statsRoutes";

const app: Application = express();

// ─── Security Middleware ──────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGIN, credentials: true }));

// ─── Body Parsing ─────────────────────────────────────────
app.use(express.json());

// ─── Request Logger ───────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const logger = require("./config/logger").default;
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────
app.use(healthRoutes);
app.use("/api/stats", statsRoutes);

// ─── Error Handling ───────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
