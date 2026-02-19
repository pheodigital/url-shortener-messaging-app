import { Router, Request, Response } from "express";
import { checkDatabaseHealth } from "../../config/database";

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
  const postgres = await checkDatabaseHealth();

  // If any critical dependency is down → return 503
  const isHealthy = postgres === "ok";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    service: "url-service",
    timestamp: new Date().toISOString(),
    dependencies: {
      postgres,
      // redis    → added in PR-07
      // rabbitmq → added in PR-14
    },
  });
});

export default router;
