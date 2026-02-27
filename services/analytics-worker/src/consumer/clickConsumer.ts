import { ConsumeMessage } from "amqplib";
import { getChannel } from "../config/rabbitmq";
import clickEventModel from "../models/clickEvent";
import logger from "../config/logger";
import env from "../config/env";

// ─── Raw Message Shape ────────────────────────────────────
// What we expect to receive from url-service
// Must match ClickEvent interface in url-service/clickPublisher.ts
interface RawClickEvent {
  shortcode: string;
  longUrl: string;
  timestamp: string; // ISO string from url-service
  ip: string;
  userAgent: string;
}

// ─── Process Message ──────────────────────────────────────
// Called for every message delivered from RabbitMQ
//
// Three outcomes:
//   1. Success  → store in MongoDB → ack message (removed from queue)
//   2. Bad JSON → nack without requeue (malformed — will never succeed)
//   3. DB error → nack with requeue (temporary failure — try again later)
const processMessage = async (msg: ConsumeMessage): Promise<void> => {
  let raw: RawClickEvent;

  // ── Parse JSON ───────────────────────────────────────────
  try {
    raw = JSON.parse(msg.content.toString()) as RawClickEvent;
  } catch {
    logger.error("Failed to parse click event — discarding message", {
      content: msg.content.toString(),
    });

    // nack with requeue: false → message goes to dead letter queue
    // or is discarded — no point retrying malformed JSON
    getChannel().nack(msg, false, false);
    return;
  }

  // ── Validate required fields ──────────────────────────────
  if (!raw.shortcode || !raw.longUrl || !raw.timestamp) {
    logger.error("Click event missing required fields — discarding", { raw });
    getChannel().nack(msg, false, false);
    return;
  }

  // ── Store in MongoDB ──────────────────────────────────────
  try {
    await clickEventModel.create({
      shortcode: raw.shortcode,
      longUrl: raw.longUrl,
      timestamp: new Date(raw.timestamp),
      ip: raw.ip,
      userAgent: raw.userAgent,
    });

    logger.info("Click event stored", { shortcode: raw.shortcode });

    // ack — message successfully processed, remove from queue
    getChannel().ack(msg);
  } catch (error) {
    logger.error("Failed to store click event — requeueing", {
      shortcode: raw.shortcode,
      error,
    });

    // nack with requeue: true → message goes back to queue
    // another worker instance (or this one after reconnect) will retry
    getChannel().nack(msg, false, true);
  }
};

// ─── Start Consumer ───────────────────────────────────────
// Called once on bootstrap after RabbitMQ connection is ready
// Sets up the consume loop — runs indefinitely until process exits
//
// noAck: false → manual acknowledgement mode
//   We control when messages are removed from the queue
//   If worker crashes before ack → message redelivered automatically
export const startConsumer = async (): Promise<void> => {
  const channel = getChannel();

  await channel.consume(
    env.RABBITMQ_QUEUE_CLICK_EVENTS,
    async (msg) => {
      if (!msg) {
        // null message means consumer was cancelled by RabbitMQ
        logger.warn("Consumer cancelled by RabbitMQ");
        return;
      }

      logger.info("Click event received", {
        shortcode: (() => {
          try {
            return (JSON.parse(msg.content.toString()) as RawClickEvent)
              .shortcode;
          } catch {
            return "unknown";
          }
        })(),
      });

      await processMessage(msg);
    },
    { noAck: false }, // ← manual ack mode
  );

  logger.info(
    `Consumer started — listening on queue: ${env.RABBITMQ_QUEUE_CLICK_EVENTS}`,
  );
};
