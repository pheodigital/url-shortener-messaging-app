import mongoose, { Schema, Document } from "mongoose";

// ─── ClickEvent Interface ─────────────────────────────────
// Matches exactly what url-service publishes to RabbitMQ
// Extra fields (country, device) derived during consumption in PR-17
export interface IClickEvent extends Document {
  shortcode: string;
  longUrl: string;
  timestamp: Date;
  ip: string;
  userAgent: string;
  createdAt: Date;
}

// ─── Schema ───────────────────────────────────────────────
const ClickEventSchema = new Schema<IClickEvent>(
  {
    shortcode: {
      type: String,
      required: true,
      index: true, // ← fast lookups by shortcode for stats queries
    },
    longUrl: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true, // ← fast range queries (clicks per day/hour)
    },
    ip: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
  },
  {
    // ── Automatic timestamps ───────────────────────────────
    // createdAt — when the document was inserted into MongoDB
    // updatedAt — not really needed for events but good practice
    timestamps: true,

    // ── Collection name ────────────────────────────────────
    // Explicit name avoids Mongoose auto-pluralizing
    collection: "clickevents",
  },
);

// ─── Compound Index ───────────────────────────────────────
// Speeds up the most common analytics query:
// "how many clicks did shortcode X get in time range Y?"
ClickEventSchema.index({ shortcode: 1, timestamp: -1 });

const ClickEventModel = mongoose.model<IClickEvent>(
  "ClickEvent",
  ClickEventSchema,
);

export default ClickEventModel;
