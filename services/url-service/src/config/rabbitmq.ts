import amqp, { ChannelModel, Channel } from "amqplib";
import logger from "./logger";
import env from "./env";

// ─── Singleton ────────────────────────────────────────────
// One connection and one channel shared across the entire service.
// Creating a new connection per request is expensive (~500ms).
// A single long-lived connection handles thousands of publishes/sec.
let connection: ChannelModel | undefined;
let channel: Channel | undefined;

// ─── Connect ──────────────────────────────────────────────
// Called once on bootstrap in index.ts alongside connectDatabase
// and connectRedis. Asserts the click_events queue so it exists
// before any redirect tries to publish to it.
export const connectRabbitMQ = async (): Promise<void> => {
  try {
    // cloudamqp.com provides a RabbitMQ URL with credentials and vhost included
    connection = await amqp.connect(env.RABBITMQ_URL as string);
    channel = await connection.createChannel();

    // ── Assert queue ─────────────────────────────────────
    // durable: true → queue survives RabbitMQ restarts
    // Messages in a durable queue are not lost on restart
    await channel.assertQueue(env.RABBITMQ_QUEUE_CLICK_EVENTS, {
      durable: true,
    });

    logger.info("RabbitMQ connected successfully");
    logger.info(`Queue asserted: ${env.RABBITMQ_QUEUE_CLICK_EVENTS}`);

    // ── Handle unexpected disconnection ──────────────────
    connection.on("error", (error) => {
      logger.error("RabbitMQ connection error", { error: error.message });
    });

    connection.on("close", () => {
      logger.warn("RabbitMQ connection closed unexpectedly");
      channel = undefined;
      connection = undefined;
    });
  } catch (error) {
    logger.error("RabbitMQ connection failed", { error });
    process.exit(1);
  }
};

// ─── Get Channel ──────────────────────────────────────────
// Used by publishers (PR-15) to get the shared channel
// Throws if called before connectRabbitMQ()
export const getChannel = (): Channel => {
  if (!channel) {
    throw new Error(
      "RabbitMQ channel not initialised — call connectRabbitMQ() first",
    );
  }
  return channel;
};

// ─── Health Check ─────────────────────────────────────────
// Checks if channel is open — used by GET /health
// Returns "ok" or "error" — never throws
export const checkRabbitMQHealth = (): "ok" | "error" => {
  try {
    // If channel exists and connection exists → healthy
    // No need to send a message — just check the objects exist
    if (channel && connection) {
      return "ok";
    }
    return "error";
  } catch {
    return "error";
  }
};

// ─── Disconnect ───────────────────────────────────────────
// Called during graceful shutdown in index.ts
// Closes channel then connection cleanly
export const disconnectRabbitMQ = async (): Promise<void> => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    logger.info("RabbitMQ disconnected gracefully");
  } catch (error) {
    logger.error("RabbitMQ disconnect error", { error });
  }
};
