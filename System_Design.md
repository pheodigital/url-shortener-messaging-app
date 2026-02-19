# 🧠 System Design — URL Shortener + Analytics Platform

This document covers the complete system design decisions: why we chose each component, what tradeoffs we made, and how the system behaves under load.

---

## 1. Problem Statement

### Functional Requirements
- User can create a short URL from a long URL
- Anyone can visit the short URL and get redirected to the original
- Users must be authenticated (Google OAuth2) to create URLs
- Dashboard shows analytics: total clicks, per URL stats, location, device
- Users can delete their own URLs

### Non-Functional Requirements
- Redirect must be **fast** (< 10ms p99 ideally, cache-first)
- System must handle **high read traffic** (redirects >> writes)
- Analytics can be **eventually consistent** (slight delay is acceptable)
- Auth must be **stateless** (servers can scale horizontally)
- System must be **observable** (logs, metrics, traces)

---

## 2. Capacity Estimation

### Assumptions (for learning context)
```
Daily active users         →  10,000
URLs created per day       →  5,000
Redirects per day          →  500,000   (100x write ratio)
Analytics events per day   →  500,000   (1 per redirect)
```

### Read/Write Ratio
```
Reads (redirects)  : Writes (create URL) = 100 : 1

This tells us:
→ Optimize heavily for READ path
→ Cache is not optional, it's critical
→ Write path can afford slightly more latency
```

### Storage Estimation
```
PostgreSQL (URLs table):
  Each row ≈ 500 bytes
  5,000 URLs/day × 365 days = 1.8M rows/year
  Storage: ~900 MB/year → very manageable

Redis (Cache):
  Each entry ≈ 200 bytes (shortcode + longURL)
  Cache top 100K URLs → ~20 MB → negligible

MongoDB (Click events):
  Each event ≈ 300 bytes
  500,000 events/day × 365 = 182M events/year
  Storage: ~55 GB/year → needs indexing strategy
```

---

## 3. API Design

### Auth Service (PORT 3001)

```
GET  /auth/google              → Redirect to Google OAuth2
GET  /auth/google/callback     → Handle OAuth2 callback, issue JWT
POST /auth/logout              → Blacklist JWT in Redis
GET  /auth/me                  → Return current user info
GET  /health                   → Health check
```

### URL Service (PORT 3002)

```
POST   /api/urls               → Create short URL (authenticated)
GET    /api/urls               → List my URLs (authenticated)
DELETE /api/urls/:id           → Delete a URL (authenticated)
GET    /:shortcode             → Redirect to long URL (public, HOT PATH)
GET    /health                 → Health check
```

### Analytics Service (PORT 3003)

```
GET  /api/analytics/:shortcode       → Stats for one URL
GET  /api/analytics/dashboard        → Aggregated stats for user
GET  /health                         → Health check
```

---

## 4. Database Design

### PostgreSQL Schema

```sql
-- Users table
users
├── id          UUID PRIMARY KEY
├── email       VARCHAR UNIQUE NOT NULL
├── name        VARCHAR
├── googleId    VARCHAR UNIQUE
├── createdAt   TIMESTAMP DEFAULT NOW()
└── updatedAt   TIMESTAMP

-- URLs table
urls
├── id          UUID PRIMARY KEY
├── shortcode   VARCHAR(10) UNIQUE NOT NULL  ← indexed
├── longUrl     TEXT NOT NULL
├── userId      UUID REFERENCES users(id)
├── isActive    BOOLEAN DEFAULT TRUE
├── createdAt   TIMESTAMP DEFAULT NOW()
└── updatedAt   TIMESTAMP

-- Indexes
CREATE INDEX idx_urls_shortcode ON urls(shortcode);   ← critical for redirect
CREATE INDEX idx_urls_userId ON urls(userId);
```

### MongoDB Schema (Analytics)

```javascript
// click_events collection
{
  _id: ObjectId,
  shortcode: String,      // indexed
  longUrl: String,
  userId: String,
  timestamp: Date,        // indexed
  ip: String,
  userAgent: String,
  country: String,
  city: String,
  device: String,         // mobile / desktop / tablet
  browser: String,
  referrer: String
}

// Indexes
{ shortcode: 1 }
{ shortcode: 1, timestamp: -1 }
{ userId: 1, timestamp: -1 }
```

### Redis Key Design

```
# URL Cache (TTL: 24 hours)
url:{shortcode}  →  "https://original-long-url.com"

# JWT Blacklist (TTL: token expiry time)
blacklist:{jti}  →  "1"

# Rate Limiting (TTL: 60 seconds)
ratelimit:{ip}   →  "count"

# Session (TTL: 7 days)
session:{userId} →  { email, name, ... }
```

---

## 5. The Hot Path — Redirect Flow

This is the most critical flow. It must be as fast as possible.

```
User hits: GET /abc123
              │
              ▼
         NGINX Gateway
         (rate limit check → 429 if exceeded)
              │
              ▼
         URL Service
              │
              ├──→ Redis Cache HIT?
              │         │
              │         YES → Return 302 redirect immediately
              │               + publish click event to RabbitMQ (async)
              │               Total time: ~2-5ms
              │
              └──→ Cache MISS
                        │
                        ▼
                  Query PostgreSQL
                  (SELECT longUrl WHERE shortcode = 'abc123')
                        │
                        ▼
                  Store in Redis (TTL 24h)
                        │
                        ▼
                  Return 302 redirect
                  + publish click event to RabbitMQ (async)
                  Total time: ~20-50ms
```

**Why fire-and-forget to RabbitMQ?**
Because analytics are non-critical. If we waited for MongoDB to write before redirecting, we'd add 20-100ms to every single redirect. That's unacceptable.

---

## 6. Caching Strategy

### Cache-Aside Pattern (what we use)

```
Read:
  1. Check Redis first
  2. If HIT → return value
  3. If MISS → read from PostgreSQL → write to Redis → return value

Write (create URL):
  1. Write to PostgreSQL (source of truth)
  2. Optionally pre-warm cache (write to Redis too)

Delete (URL removed):
  1. Delete from PostgreSQL
  2. DELETE the Redis key immediately (cache invalidation)
```

### Why Cache-Aside and not Write-Through?
Write-through would cache everything on write. Since most URLs may never be visited, we'd waste Redis memory. Cache-aside only caches what's actually requested.

### Cache TTL Decision
```
24 hours TTL on URL cache:
  - Long enough to keep hot URLs in cache
  - Short enough that deleted URLs eventually expire
  - But we also do explicit invalidation on delete (belt + suspenders)
```

---

## 7. Async Processing & Backpressure

### Why RabbitMQ for Click Events?

```
Without queue (synchronous):
  Redirect → write to MongoDB → respond
  Problem: MongoDB write adds latency to every redirect

With queue (asynchronous):
  Redirect → publish to RabbitMQ → respond immediately
  Worker  → consumes from queue  → writes to MongoDB
  
  User experience: instant redirect
  Analytics: slightly delayed (seconds) — totally acceptable
```

### Backpressure Handling

```
Scenario: Traffic spike → 10,000 clicks/second
          Worker can only process 1,000 events/second

Without backpressure:
  Queue fills up → memory explodes → system crashes

With backpressure (our approach):
  RabbitMQ queue has max length limit
  Worker uses prefetch count (only take N messages at a time)
  Publisher checks if queue is full before publishing
  If queue full → drop event (analytics loss is acceptable)
                  OR → store in fallback (Redis list)
```

```
RabbitMQ Config:
  prefetch count: 10        (worker takes 10 at a time)
  queue max length: 100,000 (after this, oldest dropped)
  message TTL: 24 hours     (stale events discarded)
```

---

## 8. Rate Limiting Design

### Strategy: Token Bucket via Redis

```
Every IP gets a bucket of 100 tokens per minute

Request comes in:
  1. GET ratelimit:{ip} from Redis
  2. If count >= 100 → return 429 Too Many Requests
  3. If count < 100  → INCR counter, set TTL 60s if new key, proceed

Why Redis for rate limiting?
  - Atomic INCR operation (no race conditions)
  - TTL handles automatic reset
  - Works across multiple instances (distributed)
```

### Rate Limit Tiers
```
/api/urls (create)     →  10 requests/min per user
/:shortcode (redirect) →  300 requests/min per IP
/auth/*                →  20 requests/min per IP
```

---

## 9. Authentication Flow

### OAuth2 Flow (Google)

```
1. User clicks "Login with Google"
2. Auth Service redirects to:
   https://accounts.google.com/oauth/authorize?client_id=...&redirect_uri=...

3. User logs in on Google

4. Google redirects back to:
   /auth/google/callback?code=AUTHORIZATION_CODE

5. Auth Service exchanges code for tokens:
   POST https://oauth2.googleapis.com/token
   Response: { access_token, id_token, ... }

6. Auth Service decodes id_token → gets user info (email, name, googleId)

7. Auth Service creates/finds user in PostgreSQL

8. Auth Service issues our own JWT:
   {
     sub: userId,
     email: user.email,
     jti: uniqueTokenId,   ← for blacklisting on logout
     iat: now,
     exp: now + 7days
   }

9. JWT returned to client (in HTTP-only cookie or response body)

10. All future requests carry JWT in Authorization header
```

### JWT Blacklisting on Logout

```
Logout flow:
  1. Client sends POST /auth/logout with JWT
  2. Server extracts jti (unique token ID) from JWT
  3. Stores jti in Redis with TTL = remaining token lifetime
  4. Any future request with this JWT → Redis check → rejected

Why not just short expiry?
  Short expiry (15min) means users get logged out frequently.
  With blacklisting, we can have long expiry (7 days) + instant logout.
```

---

## 10. Scalability Design

### Horizontal Scaling — URL Service

```
                    NGINX (Load Balancer)
                   /         |          \
          URL Service   URL Service   URL Service
          Instance 1    Instance 2    Instance 3
                   \         |          /
                    PostgreSQL + Redis
                    (shared data layer)

Why this works:
  - No in-memory state on URL Service instances
  - All state lives in PostgreSQL and Redis
  - NGINX round-robins requests across instances
  - Any instance can handle any request
```

### What Makes Horizontal Scaling Possible?

```
✅ Stateless servers        → no local memory state
✅ Shared Redis sessions     → session works on any instance
✅ Shared PostgreSQL         → data consistent across instances
✅ JWT auth                  → no server-side session needed
✅ Shared Redis rate limiter → rate limits apply globally
```

### Connection Pooling

```
Without pooling:
  Each request opens a new DB connection
  PostgreSQL max connections: ~100
  1000 concurrent requests → 1000 connections → crash

With pooling (Prisma default):
  Pool of 10 connections shared across all requests
  Requests queue if pool is busy
  Much more efficient
  
Prisma connection pool config:
  connection_limit: 10   (per service instance)
  pool_timeout: 10       (seconds to wait for connection)
```

---

## 11. CAP Theorem in Our Stack

```
PostgreSQL → CP (Consistency + Partition Tolerance)
  - Prioritizes data consistency
  - Won't return stale data
  - Used for: users, URLs (must be accurate)

Redis → AP (Availability + Partition Tolerance)
  - Prioritizes availability
  - May serve slightly stale cache in edge cases
  - Used for: cache, sessions (slight staleness acceptable)

MongoDB → AP (tunable)
  - Eventual consistency for analytics
  - We don't need analytics to be instantly accurate
  - Used for: click events (eventual consistency fine)
```

This is why we have **3 databases** — each is the right tool for its data's consistency requirements.

---

## 12. Eventual Consistency — Analytics

```
Click happens at T=0
  │
  ▼
Published to RabbitMQ at T=0ms
  │
  ▼
Redirect response sent at T=5ms   ← user gets redirected immediately
  │
  ▼
Worker consumes event at T=500ms  ← slight delay
  │
  ▼
Stored in MongoDB at T=520ms
  │
  ▼
Dashboard shows updated count     ← user sees it ~1 second later
```

This is eventual consistency in practice. The analytics dashboard is **not instantly accurate** but it doesn't need to be. The tradeoff is worth the redirect speed gain.

---

## 13. Environment Strategy

```
.env.development   → local dev, local DBs, verbose logging
.env.test          → test runner, in-memory or test DBs
.env.production    → real credentials via secrets manager, minimal logging

Never commit .env files → use .env.example as template
```

---

## 14. Health Checks

Every service exposes `GET /health`:

```json
{
  "status": "ok",
  "service": "url-service",
  "timestamp": "2024-01-01T00:00:00Z",
  "dependencies": {
    "postgres": "ok",
    "redis": "ok",
    "rabbitmq": "ok"
  }
}
```

Used by: Docker healthcheck, Kubernetes liveness/readiness probes, NGINX upstream health checks.

---

## 15. What We Discussed But Won't Build

| Concept | Where It Applies | How We Handle It |
|---|---|---|
| Kafka | High-throughput event streaming | Discussed theoretically; RabbitMQ used instead |
| WebSockets | Real-time dashboard updates | Polling every 5s instead |
| Vertical Scaling | Bigger server = more capacity | Discussed as Phase 1 of scaling; we go horizontal |
| CDN | Edge caching for global speed | Out of scope; mentioned as next step |
| Database sharding | Splitting DB across servers | Out of scope; discussed as future scaling step |
| Read replicas | Separate read/write DB instances | Out of scope; discussed conceptually |
