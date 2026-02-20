import { Request, Response } from "express";
import { nanoid } from "nanoid";
import prisma from "../config/database";
import env from "../config/env";
import logger from "../config/logger";
import { AppError } from "../middleware/errorHandler";
import { CreateUrlInput } from "../schemas/urlSchemas";

// ─── Create Short URL ─────────────────────────────────────
// POST /api/urls
// Body: { longUrl: string, customCode?: string }
//
// Flow:
//   1. Check if customCode is taken (if provided)
//   2. Generate shortcode via nanoid (if no customCode)
//   3. Save to PostgreSQL
//   4. Return the short URL
export const createUrl = async (req: Request, res: Response): Promise<void> => {
  // req.body is already validated and typed by validate() middleware
  const { longUrl, customCode } = req.body as CreateUrlInput;

  // ── Determine shortcode ──────────────────────────────────
  let shortcode: string;

  if (customCode) {
    // Check if custom code is already taken
    const existing = await prisma.url.findUnique({
      where: { shortcode: customCode },
    });

    if (existing) {
      throw new AppError(`Custom code '${customCode}' is already taken`, 409);
    }

    shortcode = customCode;
  } else {
    // Generate a random 7-character URL-safe shortcode
    // nanoid is URL-safe (no +, /, = characters)
    // 7 chars gives us ~3.5 trillion combinations — collision is extremely unlikely
    shortcode = nanoid(7);
  }

  // ── Save to database ─────────────────────────────────────
  const url = await prisma.url.create({
    data: {
      shortcode,
      longUrl,
      // userId will be added in PR-13 when auth is implemented
      // userId: req.user.id
    },
  });

  logger.info("URL created", { shortcode, longUrl });

  // ── Return response ──────────────────────────────────────
  res.status(201).json({
    status: "success",
    data: {
      id: url.id,
      shortcode: url.shortcode,
      shortUrl: `${env.BASE_URL}/${url.shortcode}`, // full short URL
      longUrl: url.longUrl,
      createdAt: url.createdAt,
    },
  });
};

// ─── List URLs ────────────────────────────────────────────
// GET /api/urls
//
// Returns all active URLs.
// In PR-13 (auth) this will be filtered to only the logged-in user's URLs.
// For now returns all URLs — no auth yet.
export const listUrls = async (req: Request, res: Response): Promise<void> => {
  const urls = await prisma.url.findMany({
    where: {
      isActive: true,
      // userId: req.user.id  ← added in PR-13
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shortcode: true,
      longUrl: true,
      createdAt: true,
    },
  });

  // Map over results to add the full shortUrl to each item
  const data = urls.map((url) => ({
    ...url,
    shortUrl: `${env.BASE_URL}/${url.shortcode}`,
  }));

  res.status(200).json({
    status: "success",
    count: data.length,
    data,
  });
};

// ─── Delete URL ───────────────────────────────────────────
// DELETE /api/urls/:id
//
// Soft delete — sets isActive: false instead of removing the row.
// Why soft delete?
//   - Analytics history is preserved (click events still reference this URL)
//   - The shortcode is "retired" not reused (prevents confusion)
//   - Data can be recovered if deleted by mistake
//
// In PR-13 (auth) we add an ownership check:
//   only the user who created the URL can delete it
export const deleteUrl = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Check if URL exists and is active
  const url = await prisma.url.findUnique({
    where: { id },
  });

  if (!url) {
    throw new AppError("URL not found", 404);
  }

  if (!url.isActive) {
    throw new AppError("URL is already deleted", 410);
  }

  // Ownership check goes here in PR-13:
  // if (url.userId !== req.user.id) throw new AppError("Forbidden", 403)

  // Soft delete — mark as inactive
  await prisma.url.update({
    where: { id },
    data: { isActive: false },
  });

  logger.info("URL deleted", { id, shortcode: url.shortcode });

  res.status(200).json({
    status: "success",
    message: "URL deleted successfully",
  });
};
