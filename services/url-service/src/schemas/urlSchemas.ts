import { z } from "zod";

// ─── Create URL Schema ────────────────────────────────────
// Validates the request body for POST /api/urls
// longUrl must be a properly formatted URL — nothing else accepted
export const createUrlSchema = z.object({
  longUrl: z
    .string({ required_error: "longUrl is required" })
    .url("longUrl must be a valid URL including http:// or https://")
    .max(2048, "longUrl must be under 2048 characters"),

  // customCode is optional — user can request a custom shortcode
  // if not provided, we generate one with nanoid
  // added here for future use — not implemented until later
  customCode: z
    .string()
    .min(3, "customCode must be at least 3 characters")
    .max(20, "customCode must be under 20 characters")
    .regex(
      /^[a-zA-Z0-9-_]+$/,
      "customCode can only contain letters, numbers, hyphens and underscores",
    )
    .optional(),
});

// ─── Infer Types ──────────────────────────────────────────
// TypeScript type inferred automatically from the schema
// No need to write a manual interface
export type CreateUrlInput = z.infer<typeof createUrlSchema>;
