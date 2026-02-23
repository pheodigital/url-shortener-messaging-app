import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { createUrlSchema } from "../../schemas/urlSchemas";
import {
  createUrl,
  listUrls,
  deleteUrl,
} from "../../controllers/urlController";

const router = Router();

// ─── URL Routes ───────────────────────────────────────────
// All routes require authentication from PR-13 onwards
//
// Middleware chain:
//   authenticate → verifies JWT, attaches req.user
//   validate     → validates req.body (POST only)
//   controller   → runs only if all middleware passes

// POST /api/urls — create a short URL owned by authenticated user
router.post("/", authenticate, validate(createUrlSchema), createUrl);

// GET /api/urls — list authenticated user's URLs only
router.get("/", authenticate, listUrls);

// DELETE /api/urls/:id — soft delete (ownership check in controller)
router.delete("/:id", authenticate, deleteUrl);

export default router;
