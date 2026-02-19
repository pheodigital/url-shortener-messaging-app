import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Seed Data ────────────────────────────────────────────
// This data is only for development and testing.
// Never run this against production.
//
// Run with:
//   npm run db:seed
//
// Reset DB and re-seed:
//   npm run db:reset  (wipes everything + re-runs migrations)
//   npm run db:seed   (re-inserts seed data)

const users = [
  {
    id: "seed-user-001",
    email: "test@example.com",
    name: "Test User",
    googleId: "google-test-001",
  },
];

const urls = [
  {
    shortcode: "google",
    longUrl: "https://www.google.com",
    userId: "seed-user-001",
  },
  {
    shortcode: "github",
    longUrl: "https://www.github.com",
    userId: "seed-user-001",
  },
  {
    shortcode: "prisma",
    longUrl: "https://www.prisma.io/docs",
    userId: "seed-user-001",
  },
  {
    shortcode: "express",
    longUrl: "https://expressjs.com",
    userId: "seed-user-001",
  },
];

// ─── Main Seed Function ───────────────────────────────────
const seed = async (): Promise<void> => {
  console.log("🌱 Starting database seed...\n");

  // ── Seed Users ──────────────────────────────────────────
  console.log("👤 Seeding users...");

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {}, // if user already exists → do nothing, skip
      create: user,
    });
    console.log(`   ✓ User: ${created.email} (id: ${created.id})`);
  }

  // ── Seed URLs ───────────────────────────────────────────
  console.log("\n🔗 Seeding URLs...");

  for (const url of urls) {
    const created = await prisma.url.upsert({
      where: { shortcode: url.shortcode },
      update: {}, // if shortcode already exists → do nothing, skip
      create: url,
    });
    console.log(`   ✓ ${created.shortcode} → ${created.longUrl}`);
  }

  // ── Summary ─────────────────────────────────────────────
  const userCount = await prisma.user.count();
  const urlCount = await prisma.url.count();

  console.log("\n✅ Seed complete!");
  console.log(`   Users : ${userCount}`);
  console.log(`   URLs  : ${urlCount}`);
  console.log("\n💡 Test these redirects after starting the server:");

  urls.forEach((url) => {
    console.log(`   http://localhost:3002/${url.shortcode}`);
  });
};

// ─── Run ──────────────────────────────────────────────────
seed()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    // Always disconnect after seeding
    await prisma.$disconnect();
  });
