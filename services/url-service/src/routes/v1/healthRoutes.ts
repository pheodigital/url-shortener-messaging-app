import { Router, Request, Response } from "express";
import { checkDatabaseHealth } from "../../config/database";
import { checkRedisHealth } from "../../config/redis";
import { checkRabbitMQHealth } from "../../config/rabbitmq";

const router = Router();

// ─── GET /health ──────────────────────────────────────────
// Dependencies:
//   PR-03 → postgres
//   PR-07 → redis
//   PR-14 → rabbitmq  (this PR)
router.get("/health", async (req: Request, res: Response) => {
  const [postgres, redis] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  // checkRabbitMQHealth is synchronous — no need to include in Promise.all
  const rabbitmq = checkRabbitMQHealth();

  const isHealthy = postgres === "ok" && redis === "ok" && rabbitmq === "ok";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    service: "url-service",
    timestamp: new Date().toISOString(),
    dependencies: {
      postgres,
      redis,
      rabbitmq,
    },
  });
});

export default router;
