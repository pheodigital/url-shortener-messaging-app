import mongoose from "mongoose";
import logger from "./logger";
import env from "./env";

// ─── Connect ──────────────────────────────────────────────
// Called once on bootstrap in index.ts
// Mongoose maintains a connection pool internally —
// no need to manage individual connections manually
export const connectMongoDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      // ── Connection pool settings ───────────────────────
      // maxPoolSize: max concurrent connections to MongoDB
      // Kept low for free tier Atlas (M0 has limits)
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000, // fail fast if Atlas unreachable
      socketTimeoutMS: 45000,
    });

    logger.info("MongoDB connected successfully");

    // ── Event listeners ──────────────────────────────────
    mongoose.connection.on("error", (error) => {
      logger.error("MongoDB error", { error: error.message });
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });
  } catch (error) {
    logger.error("MongoDB connection failed", { error });
    process.exit(1);
  }
};

// ─── Health Check ─────────────────────────────────────────
// Returns "ok" if Mongoose connection state is connected
// readyState 1 = connected
export const checkMongoDBHealth = (): "ok" | "error" => {
  return mongoose.connection.readyState === 1 ? "ok" : "error";
};

// ─── Disconnect ───────────────────────────────────────────
// Called during graceful shutdown
export const disconnectMongoDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info("MongoDB disconnected gracefully");
  } catch (error) {
    logger.error("MongoDB disconnect error", { error });
  }
};

export default mongoose;
