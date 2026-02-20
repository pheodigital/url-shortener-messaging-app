import { Router } from "express";
import { redirect } from "../../controllers/redirectController";

const router = Router();

// ─── GET /:shortcode ──────────────────────────────────────
// Public route — no auth needed, anyone can follow a short URL
//
// ⚠️  IMPORTANT — Registration Order:
// This route MUST be registered LAST in app.ts
// because /:shortcode is a catch-all pattern.
//
// If registered before /api/urls:
//   GET /api/urls → Express matches /:shortcode first
//                 → shortcode = "api" → 404
//                 → /api/urls never reached ❌
//
// If registered after /api/urls (correct):
//   GET /api/urls → matches /api/urls first ✅
//   GET /abc123   → falls through to /:shortcode ✅
router.get("/:shortcode", redirect);

export default router;
