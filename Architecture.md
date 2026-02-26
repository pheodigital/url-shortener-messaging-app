# 🏛️ Architecture — URL Shortener + Analytics Platform

This document covers the structural architecture: how services are laid out, how they communicate, how data flows, and how the system is deployed.

---

## 1. High-Level Architecture

```
                         ┌─────────────────────────────────────────────┐
                         │                  CLIENTS                     │
                         │         Browser / Mobile / API Consumer      │
                         └───────────────────┬─────────────────────────┘
                                             │ HTTPS
                         ┌───────────────────▼─────────────────────────┐
                         │              NGINX GATEWAY                   │
                         │  ┌─────────────────────────────────────┐    │
                         │  │  Rate Limiting | SSL Termination     │    │
                         │  │  Load Balancing | Request Routing    │    │
                         │  └─────────────────────────────────────┘    │
                         └────┬──────────────┬──────────────┬──────────┘
                              │              │              │
               ┌──────────────▼──┐  ┌────────▼──────┐  ┌───▼──────────────┐
               │  AUTH SERVICE   │  │  URL SERVICE  │  │ ANALYTICS SERVICE │
               │   PORT: 3001    │  │  PORT: 3002   │  │   PORT: 3003      │
               │                 │  │               │  │                   │
               │ - Google OAuth2 │  │ - Create URL  │  │ - GET stats       │
               │ - Issue JWT     │  │ - Redirect    │  │ - GET dashboard   │
               │ - Logout        │  │ - List URLs   │  │ - /health         │
               │ - /me           │  │ - Delete URL  │  │                   │
               └──────┬──────────┘  └───────┬───────┘  └────────┬──────────┘
                      │                     │                    │
                      │          ┌──────────▼──────────┐        │
                      │          │      RabbitMQ        │        │
                      │          │  (click_events queue)│        │
                      │          └──────────┬──────────┘        │
                      │                     │ consumes           │
                      │          ┌──────────▼──────────┐        │
                      │          │  ANALYTICS WORKER    │        │
                      │          │   (background job)   │        │
                      │          └──────────┬──────────┘        │
                      │                     │                    │
          ┌───────────┼─────────────────────┼────────────────────┼────────────┐
          │           │      DATA LAYER      │                    │            │
          │  ┌────────▼────────┐  ┌─────────▼──────┐  ┌─────────▼──────────┐ │
          │  │   PostgreSQL    │  │     Redis       │  │      MongoDB        │ │
          │  │                 │  │                 │  │                     │ │
          │  │ users           │  │ url cache       │  │ click_events        │ │
          │  │ urls            │  │ jwt blacklist   │  │ aggregated_stats    │ │
          │  │                 │  │ rate limits     │  │                     │ │
          │  │ PORT: 5432      │  │ PORT: 6379      │  │ PORT: 27017         │ │
          │  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
          └───────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Architecture

### 2.1 Auth Service

```
auth-service/
├── src/
│   ├── index.js                  ← Express app bootstrap
│   ├── config/
│   │   ├── passport.js           ← Google OAuth2 strategy config
│   │   └── redis.js              ← Redis connection
│   ├── middleware/
│   │   ├── authenticate.js       ← JWT verification middleware
│   │   └── errorHandler.js       ← Global error handler
│   ├── controllers/
│   │   └── authController.js     ← Login, callback, logout, me
│   └── routes/
│       └── authRoutes.js         ← Route definitions

Responsibilities:
  ✅ Handle Google OAuth2 redirect
  ✅ Exchange auth code for Google tokens
  ✅ Create/find user in PostgreSQL
  ✅ Issue signed JWT
  ✅ Blacklist JWT on logout (Redis)
  ✅ Expose /me endpoint
  ❌ Does NOT handle URL operations
  ❌ Does NOT handle analytics
```

### 2.2 URL Service

```
url-service/
├── src/
│   ├── index.js                  ← Express app bootstrap
│   ├── config/
│   │   ├── database.js           ← Prisma client
│   │   ├── redis.js              ← Redis connection
│   │   └── rabbitmq.js           ← RabbitMQ connection + publisher
│   ├── middleware/
│   │   ├── authenticate.js       ← Verify JWT (same logic as auth service)
│   │   ├── rateLimiter.js        ← Redis-based rate limiter
│   │   └── errorHandler.js
│   ├── controllers/
│   │   ├── urlController.js      ← Create, list, delete
│   │   └── redirectController.js ← The HOT PATH
│   ├── services/
│   │   ├── cacheService.js       ← Redis get/set/delete
│   │   └── publishService.js     ← Publish to RabbitMQ
│   ├── routes/
│   │   └── urlRoutes.js
│   └── prisma/
│       └── schema.prisma         ← DB schema

Responsibilities:
  ✅ CRUD for URLs (authenticated)
  ✅ Redirect shortcode → longURL (public, hot path)
  ✅ Cache reads/writes via Redis
  ✅ Publish click events to RabbitMQ
  ✅ Rate limit incoming requests
  ❌ Does NOT process analytics itself
  ❌ Does NOT handle auth login flow
```

### 2.3 Analytics Worker

```
analytics-worker/
├── src/
│   ├── index.js                  ← Bootstrap, start consumer
│   ├── config/
│   │   ├── mongodb.js            ← Mongoose connection
│   │   └── rabbitmq.js           ← RabbitMQ consumer setup
│   ├── consumers/
│   │   └── clickConsumer.js      ← Process click events from queue
│   ├── models/
│   │   └── ClickEvent.js         ← Mongoose schema
│   ├── services/
│   │   └── analyticsService.js   ← Aggregate stats queries
│   └── routes/
│       ├── analyticsRoutes.js    ← /stats, /dashboard
│       └── healthRoutes.js       ← /health

Responsibilities:
  ✅ Consume click events from RabbitMQ
  ✅ Parse and enrich events (device, browser detection)
  ✅ Store in MongoDB
  ✅ Serve analytics API
  ❌ Does NOT redirect users
  ❌ Does NOT manage URL creation
```

---

## 3. Communication Patterns

```
┌─────────────────────────────────────────────────────────┐
│              SERVICE COMMUNICATION MAP                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Client → NGINX → Auth Service        : HTTP REST       │
│  Client → NGINX → URL Service         : HTTP REST       │
│  Client → NGINX → Analytics Service  : HTTP REST        │
│                                                         │
│  URL Service → PostgreSQL             : TCP (Prisma)    │
│  URL Service → Redis                  : TCP (ioredis)   │
│  URL Service → RabbitMQ               : AMQP (amqplib)  │
│                                                         │
│  Auth Service → PostgreSQL            : TCP (Prisma)    │
│  Auth Service → Redis                 : TCP (ioredis)   │
│  Auth Service → Google OAuth2         : HTTPS           │
│                                                         │
│  Analytics Worker → RabbitMQ          : AMQP (consume)  │
│  Analytics Worker → MongoDB           : TCP (mongoose)  │
│                                                         │
│  Analytics Service → MongoDB          : TCP (mongoose)  │
│                                                         │
└─────────────────────────────────────────────────────────┘

Sync  (HTTP):  Client calls, waits for response
Async (AMQP):  URL Service publishes, Worker consumes independently
```

---

## 4. Data Flow Diagrams

### 4.1 Create Short URL

```
Client                NGINX          URL Service        PostgreSQL       Redis
  │                     │                │                  │              │
  │─── POST /api/urls ──►│                │                  │              │
  │   { longUrl }        │                │                  │              │
  │                     │──────────────►│                  │              │
  │                     │  (auth check)  │                  │              │
  │                     │               │── validate JWT   │              │
  │                     │               │── generate nanoid shortcode      │
  │                     │               │── INSERT url row ──►│              │
  │                     │               │                  │              │
  │                     │               │◄── { id, shortcode } ─┤              │
  │                     │               │                  │              │
  │                     │               │── SET url:{shortcode} ──────────►│
  │                     │               │   (optional pre-warm)            │
  │                     │               │                  │              │
  │◄────────────────────┤◄──────────────┤                  │              │
  │  { shortcode, shortUrl }            │                  │              │
```

### 4.2 Redirect (Hot Path)

```
Client         NGINX       URL Service      Redis      PostgreSQL    RabbitMQ
  │              │               │             │             │            │
  │─ GET /abc123►│               │             │             │            │
  │              │──────────────►│             │             │            │
  │              │ (rate limit)  │             │             │            │
  │              │               │─ GET url:abc123 ─────────►│            │
  │              │               │             │             │            │
  │              │               │  ◄── HIT ───┤             │            │
  │              │               │             │             │            │
  │              │               │─── publish click event ───────────────►│
  │              │               │             │             │            │
  │◄─────────────┤◄──────────────┤             │             │            │
  │  302 Redirect│               │             │             │            │
  │  Location: https://longurl  │             │             │            │
```

```
(On Cache MISS:)
  │              │               │─ GET url:abc123 ─────────►│            │
  │              │               │  ◄── MISS ───┤             │            │
  │              │               │─────────── SELECT * WHERE shortcode ───►│
  │              │               │◄────────────────────── longUrl ─────────┤
  │              │               │─ SET url:abc123 (TTL 24h)──►│           │
  │              │               │─── publish click event ───────────────►│
  │◄─────────────┤◄──────────────┤
  │  302 Redirect
```

### 4.3 Analytics Processing (Async)

```
RabbitMQ Queue          Analytics Worker           MongoDB
      │                        │                      │
      │── click_events ───────►│                      │
      │   { shortcode,         │                      │
      │     ip, userAgent,     │── parse userAgent    │
      │     timestamp }        │── detect device      │
      │                        │── detect country     │
      │                        │── INSERT event ─────►│
      │                        │                      │
      │◄── ACK ────────────────┤                      │
      │   (message removed     │                      │
      │    from queue)         │                      │
```

### 4.4 Google OAuth2 Login

```
Client              Auth Service              Google              PostgreSQL
  │                      │                      │                     │
  │─ GET /auth/google ──►│                      │                     │
  │                      │──── redirect ────────►│                     │
  │◄─────────────────────┤                      │                     │
  │                                             │                     │
  │ (user logs in on Google)                    │                     │
  │                                             │                     │
  │                      │◄─── callback?code=X ─┤                     │
  │                      │                      │                     │
  │                      │──── exchange code ──►│                     │
  │                      │◄─── access_token ────┤                     │
  │                      │    + id_token        │                     │
  │                      │                      │                     │
  │                      │── decode id_token                          │
  │                      │── UPSERT user ────────────────────────────►│
  │                      │◄──────────────────── user row ─────────────┤
  │                      │                                            │
  │                      │── sign JWT { sub, email, jti, exp }        │
  │◄─── JWT token ───────┤                                            │
```

---

## 5. NGINX Configuration Architecture

```
nginx.conf structure:

upstream auth_service {
  server auth-service:3001;       ← single instance
}

upstream url_service {
  server url-service-1:3002;      ← 3 instances for load balancing
  server url-service-2:3002;
  server url-service-3:3002;
}

upstream analytics_service {
  server analytics-service:3003;  ← single instance
}

server {
  listen 80;

  # Route by path prefix
  location /auth/        → proxy to auth_service
  location /api/urls     → proxy to url_service      (auth required)
  location /api/analytics → proxy to analytics_service (auth required)
  location /             → proxy to url_service      (redirect, public)

  # Rate limiting zones
  limit_req_zone $binary_remote_addr zone=redirect:10m rate=300r/m;
  limit_req_zone $binary_remote_addr zone=api:10m      rate=60r/m;
}
```

---

## 6. Docker Architecture

### docker-compose.yml Service Map

```
Services:
├── nginx              (gateway, port 80)
├── auth-service       (port 3001, depends on: postgres, redis)
├── url-service        (port 3002, depends on: postgres, redis, rabbitmq)
│   url-service-2      (port 3012, same image, second instance)
│   url-service-3      (port 3022, same image, third instance)
├── analytics-worker   (no public port, depends on: rabbitmq, mongodb)
├── analytics-service  (port 3003, depends on: mongodb)
├── postgres           (port 5432, volume: pgdata)
├── redis              (port 6379, volume: redisdata)
├── mongodb            (port 27017, volume: mongodata)
└── rabbitmq           (port 5672 + 15672 management UI)

Networks:
└── app-network        (all services on same Docker network)

Volumes:
├── pgdata
├── redisdata
└── mongodata
```

---

## 7. Kubernetes Architecture (Phase 9)

```
Kubernetes Cluster (Minikube)
│
├── Namespace: url-shortener
│   │
│   ├── Deployments
│   │   ├── auth-service       (replicas: 1)
│   │   ├── url-service        (replicas: 3)   ← horizontal scaling
│   │   ├── analytics-worker   (replicas: 1)
│   │   └── analytics-service  (replicas: 1)
│   │
│   ├── Services (ClusterIP — internal)
│   │   ├── auth-service-svc
│   │   ├── url-service-svc    (load balances across 3 pods)
│   │   ├── analytics-worker-svc
│   │   └── analytics-service-svc
│   │
│   ├── StatefulSets (for databases)
│   │   ├── postgres
│   │   ├── redis
│   │   ├── mongodb
│   │   └── rabbitmq
│   │
│   ├── PersistentVolumeClaims
│   │   ├── postgres-pvc
│   │   ├── redis-pvc
│   │   └── mongodb-pvc
│   │
│   ├── ConfigMaps (non-secret config)
│   │   └── app-config
│   │
│   ├── Secrets (sensitive config)
│   │   ├── postgres-secret
│   │   ├── jwt-secret
│   │   └── google-oauth-secret
│   │
│   └── Ingress (Traefik)
│       └── routes external traffic to internal services
│
└── Traefik IngressController (replaces ingress-nginx)
    └── routes: /auth → auth-svc, / → url-svc, /api/analytics → analytics-svc
```

---

## 8. CI/CD Pipeline Architecture

```
GitHub Push / PR
      │
      ▼
┌─────────────────────────────────────────────────────┐
│              GitHub Actions Pipeline                  │
│                                                      │
│  Job 1: Test                                         │
│  ├── Install dependencies (npm ci)                   │
│  ├── Run unit tests (jest)                           │
│  ├── Run integration tests (supertest)               │
│  └── Report coverage                                 │
│                                                      │
│  Job 2: Build (only on main branch)                  │
│  ├── Docker build each service                       │
│  ├── Tag with commit SHA                             │
│  └── Push to Docker Hub / GHCR                      │
│                                                      │
│  Job 3: Deploy (only on main branch, after build)   │
│  ├── kubectl apply -f k8s/                           │
│  ├── kubectl rollout status                          │
│  └── Health check all services                      │
└─────────────────────────────────────────────────────┘
```

---

## 9. Observability Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY STACK                       │
├──────────────┬──────────────────┬───────────────────────────┤
│   LOGGING    │     METRICS      │         TRACING           │
│              │                  │                           │
│  Winston     │  Prometheus      │  OpenTelemetry SDK        │
│  (each svc)  │  (scrapes /metrics│  (each service)          │
│      │       │   from each svc) │        │                  │
│      │       │       │          │        │                  │
│      ▼       │       ▼          │        ▼                  │
│  Stdout JSON │   Grafana        │   Jaeger / Tempo          │
│  (Docker     │   Dashboards     │   (trace viewer)          │
│   collects)  │                  │                           │
└──────────────┴──────────────────┴───────────────────────────┘

What we measure:
  Logs    → every request, every error, service events
  Metrics → request count, latency p50/p95/p99, cache hit rate,
            queue depth, DB connection pool usage
  Traces  → one request traced across NGINX → URL Service → Redis
            → RabbitMQ → Analytics Worker → MongoDB
```

---

## 10. Build Phase → Architecture Mapping

| Phase    | Architecture Component Added                            |
| -------- | ------------------------------------------------------- |
| Phase 1  | URL Service + PostgreSQL + Prisma                       |
| Phase 2  | Redis layer (caching + invalidation)                    |
| Phase 3  | Auth Service + Google OAuth2 + JWT                      |
| Phase 4  | RabbitMQ + Analytics Worker + MongoDB                   |
| Phase 5  | Rate limiting middleware (Redis counters)               |
| Phase 6  | Docker + docker-compose (all services containerized)    |
| Phase 7  | NGINX gateway + load balanced URL Service (3 instances) |
| Phase 8  | GitHub Actions CI/CD pipeline                           |
| Phase 9  | Kubernetes cluster + Traefik ingress                    |
| Phase 10 | Prometheus + Grafana + OpenTelemetry tracing            |

---

## 11. Architecture Decisions Log (ADR)

| Decision          | Chosen       | Rejected      | Reason                                       |
| ----------------- | ------------ | ------------- | -------------------------------------------- |
| Message broker    | RabbitMQ     | Kafka         | Simpler setup, same concepts at our scale    |
| K8s Ingress       | Traefik      | ingress-nginx | ingress-nginx retiring March 2026            |
| Primary DB ORM    | Prisma       | Sequelize     | Better DX, cleaner schema definitions        |
| Redis client      | ioredis      | node-redis    | Better cluster support, more reliable        |
| Auth method       | JWT + OAuth2 | Sessions only | Stateless = horizontal scaling friendly      |
| Analytics DB      | MongoDB      | PostgreSQL    | Flexible event schema, append-heavy workload |
| Short code gen    | nanoid       | uuid          | Shorter, URL-safe, faster                    |
| Real-time updates | Polling      | WebSockets    | No genuine real-time need in this project    |
| Language          | JavaScript   | TypeScript    | Focus on backend concepts, not type system   |

## 12. Why do we do Redis

| So Why Add Redis At All?
| It comes down to speed and cost at scale.
| PostgreSQL query: ~20-50ms (network + disk + query parsing)
| Redis query: ~1-2ms (network + memory lookup only)

| For a URL shortener specifically:
| Reads (redirects) vastly outnumber writes (URL creation)
| A popular short URL might get 10,000 clicks/hour

| Without Redis:
| 10,000 requests/hour → 10,000 PostgreSQL queries/hour
| Each query costs CPU, memory, connection from the pool
| PostgreSQL connection pool gets exhausted under load

| With Redis:
| 10,000 requests/hour → ~9,990 Redis hits + ~10 PostgreSQL queries
| PostgreSQL barely feels it
| Redis handles the load in memory at ~1ms per request

Simple Rule For Real Life
Add Redis when:
✅ Same DB query runs hundreds of times per minute
✅ Query result rarely changes
✅ Response time matters to users

Skip Redis when:
❌ Low traffic (< a few hundred req/min)
❌ Data changes frequently
❌ Added complexity is not worth the gain
