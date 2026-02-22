import { Router } from "express";
import passport from "../../config/passport";
import { authenticate } from "../../middleware/authenticate";
import {
  googleCallback,
  getMe,
  logout,
  refresh,
} from "../../controllers/authController";

const router = Router();

// ─── Google OAuth Routes ──────────────────────────────────

// Step 1 — Redirect user to Google consent screen
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["email", "profile"],
    session: false,
  }),
);

// Step 2 — Google redirects back here with ?code=abc123
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/auth/failed",
  }),
  googleCallback,
);

// ─── Auth Failed ──────────────────────────────────────────
router.get("/auth/failed", (_req, res) => {
  res.status(401).json({
    status: "error",
    message: "Google authentication failed",
  });
});

// ─── Token Routes ─────────────────────────────────────────

// POST /auth/refresh — get new access token using refresh token
// Public route — no authenticate middleware needed
// (user's access token may be expired which is why they are refreshing)
router.post("/auth/refresh", refresh);

// ─── Protected Routes ─────────────────────────────────────

// GET /auth/me — returns current user
router.get("/auth/me", authenticate, getMe);

// POST /auth/logout — deletes refresh token from DB
router.post("/auth/logout", authenticate, logout);

export default router;
