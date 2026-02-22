import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./database";
import env from "./env";
import logger from "./logger";

// ─── Google OAuth2 Strategy ───────────────────────────────
// Called by Passport after Google redirects back to:
//   GET /auth/google/callback?code=abc123
//
// Flow:
//   1. Passport exchanges the code with Google for tokens
//   2. Google returns the user's profile (name, email, googleId)
//   3. We check if user exists in DB by googleId
//   4. If not → create new user (first time login)
//   5. If yes → return existing user (returning user)
//   6. done(null, user) → Passport stores user on req.user
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      scope: ["email", "profile"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;

        if (!email) {
          return done(new Error("No email returned from Google"), undefined);
        }

        // ── Find or create user ────────────────────────────
        // upsert: update if exists, create if not
        // This handles both first-time and returning users
        const user = await prisma.user.upsert({
          where: { googleId },
          update: {
            // Update name in case user changed it on Google
            name,
          },
          create: {
            googleId,
            email,
            name,
          },
        });

        logger.info("Google OAuth success", {
          userId: user.id,
          email: user.email,
        });

        return done(null, user);
      } catch (error) {
        logger.error("Google OAuth error", { error });
        return done(error as Error, undefined);
      }
    },
  ),
);

// ─── Serialize / Deserialize ──────────────────────────────
// We are using JWT not sessions so these are minimal stubs
// Passport requires them to be defined even if unused
passport.serializeUser((user: Express.User, done) => {
  done(null, user);
});

passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

export default passport;
