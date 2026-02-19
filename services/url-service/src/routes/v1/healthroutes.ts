import { Router, Request, Response } from "express";

const router = Router();

// ─── GET /health ──────────────────────────────────────────
// Used by: Docker HEALTHCHECK, K8s liveness probe, NGINX upstream check
// In later PRs we extend this response with dependency statuses:
//   PR-07 → redis: "ok" | "error"
//   PR-14 → rabbitmq: "ok" | "error"
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "url-service",
    timestamp: new Date().toISOString(),
  });
});

export default router;
