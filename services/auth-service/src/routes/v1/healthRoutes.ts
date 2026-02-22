import { Router, Request, Response } from "express";
import { checkDatabaseHealth } from "../../config/database";

const router = Router();

// ─── GET /health ──────────────────────────────────────────
// Used by Docker HEALTHCHECK and K8s liveness probes
//
// Dependencies:
//   PR-10 (this PR) → postgres
//   No Redis in auth-service — sessions stored in PostgreSQL
router.get("/health", async (req: Request, res: Response) => {
  const postgres = await checkDatabaseHealth();

  const isHealthy = postgres === "ok";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    service: "auth-service",
    timestamp: new Date().toISOString(),
    dependencies: {
      postgres,
    },
  });
});

export default router;
