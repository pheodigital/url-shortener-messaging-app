import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { getStats, getSummary } from "../../controllers/statsController";

const router = Router();

// ─── Stats Routes ─────────────────────────────────────────
// All routes prefixed with /api/stats (set in app.ts)

// GET /api/stats/summary — protected, returns stats for all user's URLs
// Must be declared BEFORE /:shortcode to avoid "summary" being
// treated as a shortcode parameter
router.get("/summary", authenticate, getSummary);

// GET /api/stats/:shortcode — public, returns stats for one URL
router.get("/:shortcode", getStats);

export default router;
