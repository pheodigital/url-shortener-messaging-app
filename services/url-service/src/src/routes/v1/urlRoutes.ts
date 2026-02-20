import { Router } from "express";
import { validate } from "../../middleware/validate";
import { createUrlSchema } from "../../schemas/urlSchemas";
import {
  createUrl,
  listUrls,
  deleteUrl,
} from "../../controllers/urlController";

const router = Router();

// ─── URL Routes ───────────────────────────────────────────
// All routes prefixed with /api/urls (set in app.ts)
//
// Middleware chain for POST:
//   validate(createUrlSchema) → validates req.body
//   createUrl                 → runs only if validation passes
//
// Auth middleware added in PR-13:
//   authenticate → validate(schema) → controller

// POST /api/urls — create a new short URL
router.post("/", validate(createUrlSchema), createUrl);

// GET /api/urls — list all URLs
// In PR-13: returns only the authenticated user's URLs
router.get("/", listUrls);

// DELETE /api/urls/:id — soft delete a URL
// In PR-13: checks ownership before deleting
router.delete("/:id", deleteUrl);

export default router;
