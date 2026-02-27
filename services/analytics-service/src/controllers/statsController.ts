import { Request, Response } from "express";
import clickEventModel from "../models/clickEvent";
import { AppError } from "../middleware/errorHandler";
import { AccessTokenPayload } from "../config/jwt";
import logger from "../config/logger";

// ─── GET /api/stats/:shortcode ────────────────────────────
// Returns click stats for a single shortcode
// Public endpoint — no auth required
// Anyone with the shortcode can see its stats
//
// Returns:
//   totalClicks     — all time click count
//   clicksToday     — clicks in the last 24 hours
//   clicksThisWeek  — clicks in the last 7 days
//   topUserAgents   — top 5 user agents by click count
export const getStats = async (req: Request, res: Response): Promise<void> => {
  const { shortcode } = req.params;

  if (!shortcode) {
    throw new AppError("Shortcode is required", 400);
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── Run all queries in parallel ───────────────────────────
  const [totalClicks, clicksToday, clicksThisWeek, topUserAgents] =
    await Promise.all([
      // Total clicks — all time
      clickEventModel.countDocuments({ shortcode }),

      // Clicks today — last 24 hours
      clickEventModel.countDocuments({
        shortcode,
        timestamp: { $gte: oneDayAgo },
      }),

      // Clicks this week — last 7 days
      clickEventModel.countDocuments({
        shortcode,
        timestamp: { $gte: oneWeekAgo },
      }),

      // Top 5 user agents by click count
      // MongoDB aggregation pipeline:
      //   1. Filter by shortcode
      //   2. Group by userAgent, count each
      //   3. Sort by count descending
      //   4. Take top 5
      clickEventModel.aggregate([
        { $match: { shortcode } },
        { $group: { _id: "$userAgent", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, userAgent: "$_id", count: 1 } },
      ]),
    ]);

  logger.debug("Stats fetched", { shortcode, totalClicks });

  res.status(200).json({
    status: "success",
    data: {
      shortcode,
      totalClicks,
      clicksToday,
      clicksThisWeek,
      topUserAgents,
    },
  });
};

// ─── GET /api/stats/summary ───────────────────────────────
// Returns aggregate stats across ALL URLs owned by this user
// Protected endpoint — requires JWT
//
// Returns:
//   totalClicks     — total clicks across all user's shortcodes
//   totalUrls       — number of distinct shortcodes clicked
//   clicksToday     — clicks today across all shortcodes
//   topShortcodes   — top 5 most clicked shortcodes
export const getSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { userId } = req.user as AccessTokenPayload;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // ── Get all shortcodes owned by this user ─────────────────
  // analytics-service does not have access to PostgreSQL
  // We get shortcodes from the click events themselves
  // This means summary only includes URLs that have been clicked
  const userShortcodes = await clickEventModel.distinct("shortcode", {
    // Note: click events do not store userId directly
    // userId filtering added in a future PR when we store userId
    // in click events. For now return stats for all shortcodes.
    // TODO PR-20: add userId to ClickEvent and filter here
  });

  const [totalClicks, clicksToday, topShortcodes] = await Promise.all([
    // Total clicks across all shortcodes
    clickEventModel.countDocuments(),

    // Clicks today across all shortcodes
    clickEventModel.countDocuments({
      timestamp: { $gte: oneDayAgo },
    }),

    // Top 5 shortcodes by total clicks
    clickEventModel.aggregate([
      { $group: { _id: "$shortcode", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, shortcode: "$_id", count: 1 } },
    ]),
  ]);

  logger.debug("Summary fetched", { userId, totalClicks });

  res.status(200).json({
    status: "success",
    data: {
      totalClicks,
      totalUrls: userShortcodes.length,
      clicksToday,
      topShortcodes,
    },
  });
};
