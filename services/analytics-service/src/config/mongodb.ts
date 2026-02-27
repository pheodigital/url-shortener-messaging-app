import mongoose from "mongoose";
import logger from "./logger";
import env from "./env";

// ─── Connect ──────────────────────────────────────────────
// analytics-service connects to the SAME MongoDB Atlas cluster
// as analytics-worker but only reads data — never writes
export const connectMongoDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info("MongoDB connected successfully");

    mongoose.connection.on("error", (error) => {
      logger.error("MongoDB error", { error: error.message });
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });
  } catch (error) {
    logger.error("MongoDB connection failed", { error });
    process.exit(1);
  }
};

// ─── Health Check ─────────────────────────────────────────
export const checkMongoDBHealth = (): "ok" | "error" => {
  return mongoose.connection.readyState === 1 ? "ok" : "error";
};

// ─── Disconnect ───────────────────────────────────────────
export const disconnectMongoDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info("MongoDB disconnected gracefully");
  } catch (error) {
    logger.error("MongoDB disconnect error", { error });
  }
};

export default mongoose;
