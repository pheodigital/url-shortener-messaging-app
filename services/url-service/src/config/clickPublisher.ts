import { getChannel } from "./rabbitmq";
import logger from "./logger";
import env from "./env";

// ─── Click Event ──────────────────────────────────────────
// The shape of every message published to the click_events queue
// analytics-worker (PR-16) consumes these and writes to DB
export interface ClickEvent {
  shortcode: string; // which short URL was clicked
  longUrl: string; // where it redirected to
  timestamp: string; // ISO string — when the click happened
  ip: string; // client IP — used for geo analytics
  userAgent: string; // browser/device — used for device analytics
}

// ─── Publish Click Event ──────────────────────────────────
// Called after every successful redirect — both HIT and MISS paths
//
// Why fire and forget?
//   The redirect (302) has already been sent to the client.
//   We never want analytics to slow down or break the redirect.
//   If RabbitMQ is down → log the error → move on.
//   The click is lost but the user experience is not affected.
//
// Why RabbitMQ instead of writing directly to DB?
//   Redirect is the hot path — must be as fast as possible.
//   Writing to DB on every click would add ~20-50ms per redirect.
//   RabbitMQ publish is ~1ms — fire and forget.
//   analytics-worker consumes the queue and writes to DB async.
export const publishClickEvent = async (event: ClickEvent): Promise<void> => {
  try {
    const channel = getChannel();

    // ── Serialize event to Buffer ────────────────────────
    // RabbitMQ messages are binary — we serialize to JSON string
    // then convert to Buffer for the wire
    const message = Buffer.from(JSON.stringify(event));

    // ── Publish to queue ─────────────────────────────────
    // persistent: true → message survives RabbitMQ restart
    // if RabbitMQ restarts before analytics-worker consumes
    // the message it will still be there when it comes back
    channel.sendToQueue(env.RABBITMQ_QUEUE_CLICK_EVENTS, message, {
      persistent: true,
    });

    logger.debug("Click event published", {
      shortcode: event.shortcode,
      ip: event.ip,
    });
  } catch (error) {
    // Never crash the redirect on a publish failure
    // Analytics loss is acceptable — redirect failure is not
    logger.error("Failed to publish click event", {
      shortcode: event.shortcode,
      error,
    });
  }
};
