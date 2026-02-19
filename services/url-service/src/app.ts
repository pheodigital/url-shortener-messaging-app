import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import "express-async-errors";

import { notFound, errorHandler } from "./middleware/errorHandler";
import healthRoutes from "./routes/v1/healthRoutes";

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  const logger = require("./config/logger").default;
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
  next();
});

app.use(healthRoutes);

// PR-04 → urlRoutes
// PR-05 → redirectRoutes

app.use(notFound);
app.use(errorHandler);

export default app;
