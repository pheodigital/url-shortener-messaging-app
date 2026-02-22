import { Router } from "express";
import passport from "../../config/passport";
import { authenticate } from "../../middleware/authenticate";
import {
  googleCallback,
  getMe,
  logout,
} from "../../controllers/authController";

const router = Router();

// ─── Google OAuth Routes ──────────────────────────────────

// Step 1 — Redirect user to Google consent screen
// Passport redirects to:
//   https://accounts.google.com/o/oauth2/auth?client_id=...
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["email", "profile"],
    session: false,
  }),
);

// Step 2 — Google redirects back here with ?code=abc123
// Passport exchanges code for profile, runs GoogleStrategy callback
// On success → calls googleCallback controller
// On failure → redirects to /auth/failed
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

// ─── Protected Routes ─────────────────────────────────────
// authenticate middleware verifies JWT before controller runs

// GET /auth/me — returns current user from JWT
router.get("/auth/me", authenticate, getMe);

// POST /auth/logout — client-side logout confirmation
router.post("/auth/logout", authenticate, logout);

export default router;
