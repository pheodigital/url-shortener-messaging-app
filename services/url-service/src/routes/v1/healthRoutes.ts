import { Router, Request, Response } from "express";

import { checkDatabaseHealth } from "../../config/database";
import { checkRedisHealth } from "../../config/redis";

const router = Router();

// ─── GET /health ──────────────────────────────────────────
// Used by: Docker HEALTHCHECK, K8s liveness probe, NGINX upstream check
//
// Returns dependency statuses so a single request tells you
// if the entire service is healthy or which dependency is down.
//
// Dependencies added per PR:
//   PR-03 (this PR) → postgres
//   PR-07           → redis
//   PR-14           → rabbitmq
router.get("/health", async (req: Request, res: Response) => {
  const [postgres, redis] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const isHealthy = postgres === "ok" && redis === "ok";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    service: "url-service",
    timestamp: new Date().toISOString(),
    dependencies: {
      postgres,
      redis,
    },
  });
});

export default router;
