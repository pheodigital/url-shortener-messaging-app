import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { createUrlSchema } from "../../schemas/urlSchemas";
import { apiLimiter } from "../../middleware/rateLimiter";
import {
  createUrl,
  listUrls,
  deleteUrl,
} from "../../controllers/urlController";

const router = Router();

// ─── URL Routes ───────────────────────────────────────────
// Middleware chain:
//   apiLimiter   → 60 req/min per user → 429 if exceeded
//   authenticate → verifies JWT, attaches req.user
//   validate     → validates req.body (POST only)
//   controller   → runs only if all middleware passes
//
// Note: apiLimiter runs BEFORE authenticate so it can still
// rate limit requests with invalid tokens by IP fallback

// POST /api/urls
router.post(
  "/",
  apiLimiter,
  authenticate,
  validate(createUrlSchema),
  createUrl,
);

// GET /api/urls
router.get("/", apiLimiter, authenticate, listUrls);

// DELETE /api/urls/:id
router.delete("/:id", apiLimiter, authenticate, deleteUrl);

export default router;
