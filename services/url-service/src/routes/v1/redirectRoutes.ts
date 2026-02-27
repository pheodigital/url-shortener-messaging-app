import { Router } from "express";
import { redirect } from "../../controllers/redirectController";
import { redirectLimiter } from "../../middleware/rateLimiter";

const router = Router();

// ─── GET /:shortcode ──────────────────────────────────────
// Public route — no auth needed
//
// Middleware chain:
//   redirectLimiter → 300 req/min per IP → 429 if exceeded
//   redirect        → cache lookup → DB lookup → 302
//
// ⚠️  Must be registered LAST in app.ts (catch-all pattern)
router.get("/:shortcode", redirectLimiter, redirect);

export default router;
