import { Router, Request, Response } from "express";
import { checkMongoDBHealth } from "../../config/mongodb";

const router = Router();

// ─── GET /health ──────────────────────────────────────────
router.get("/health", (req: Request, res: Response) => {
  const mongodb = checkMongoDBHealth();
  const isHealthy = mongodb === "ok";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    service: "analytics-service",
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb,
    },
  });
});

export default router;
