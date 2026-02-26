import amqp, { ChannelModel, Channel } from "amqplib";
import logger from "./logger";
import env from "./env";

// ─── Singleton ────────────────────────────────────────────
// Same pattern as url-service rabbitmq.ts
// but this service CONSUMES not publishes
let connection: ChannelModel | undefined;
let channel: Channel | undefined;

// ─── Connect ──────────────────────────────────────────────
export const connectRabbitMQ = async (): Promise<void> => {
  try {
    connection = await amqp.connect(env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // ── Prefetch ─────────────────────────────────────────
    // Limits how many unacknowledged messages the worker holds at once
    // Without prefetch: RabbitMQ dumps ALL queued messages at once
    // With prefetch 10: worker processes 10 at a time — controlled load
    await channel.prefetch(env.RABBITMQ_PREFETCH_COUNT);

    // ── Assert queue ─────────────────────────────────────
    // Must match url-service queue settings exactly
    // durable: true — survives RabbitMQ restart
    await channel.assertQueue(env.RABBITMQ_QUEUE_CLICK_EVENTS, {
      durable: true,
    });

    logger.info("RabbitMQ connected successfully");

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
// Used by the consumer (PR-17) to start consuming messages
export const getChannel = (): Channel => {
  if (!channel) {
    throw new Error(
      "RabbitMQ channel not initialised — call connectRabbitMQ() first",
    );
  }
  return channel;
};

// ─── Health Check ─────────────────────────────────────────
export const checkRabbitMQHealth = (): "ok" | "error" => {
  return channel && connection ? "ok" : "error";
};

// ─── Disconnect ───────────────────────────────────────────
export const disconnectRabbitMQ = async (): Promise<void> => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    logger.info("RabbitMQ disconnected gracefully");
  } catch (error) {
    logger.error("RabbitMQ disconnect error", { error });
  }
};
