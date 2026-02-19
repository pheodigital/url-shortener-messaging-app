# 📋 Project Plan — URL Shortener + Analytics Platform

Track every PR from boilerplate to production. Check off as you go.

---

## How To Use This File

```
[ ] → Not started
[~] → In progress
[x] → Done / Merged
```

Update the checkbox as you raise and merge each PR.

---

## Branch Strategy

```
main
  └── develop
        └── feature/PR-XX-description  ← your working branch
```

Always branch off `develop`. Merge feature → develop. Merge develop → main on releases.

---

## Progress Summary

```
Total PRs   : 28
Completed   : 0
In Progress : 0
Remaining   : 28
```

> Update this manually as you progress.

---

## Phase 1 — Project Foundation

- [ ] **PR-01** · Monorepo Setup & Root Config
  - `.gitignore`, `.env.example`, `README.md`, `system_design.md`, `architecture.md`, `plan.md`
  - Empty `docker-compose.yml` skeleton
  - _Concepts: project structure, environment separation_

- [ ] **PR-02** · URL Service — Boilerplate
  - Bare Express server on port `3002`
  - `GET /health` → `{ status: ok }`
  - Zod env validation on startup, Winston logger
  - _Concepts: Express setup, structured logging, env validation_

- [ ] **PR-03** · URL Service — PostgreSQL + Prisma
  - Prisma schema: `User` + `Url` models
  - DB connection singleton, migration files
  - Connection tested on startup
  - _Concepts: ORM, schema design, DB connection pooling_

- [ ] **PR-04** · URL Service — Core CRUD Endpoints
  - `POST /api/urls` → create short URL (nanoid shortcode)
  - `GET /api/urls` → list URLs
  - `DELETE /api/urls/:id` → delete URL
  - Zod request validation, proper error responses
  - _Concepts: REST API design, validation, error handling_

- [ ] **PR-05** · URL Service — Redirect Endpoint
  - `GET /:shortcode` → `302` redirect to `longUrl`
  - `404` if shortcode not found
  - No cache yet — raw DB query
  - _Concepts: HTTP redirects, hot path design_

- [ ] **PR-06** · URL Service — Unit & Integration Tests
  - Jest config, Supertest integration tests
  - Tests for all CRUD + redirect endpoints
  - Mock Prisma client
  - _Concepts: unit testing, integration testing, test doubles_

---

## Phase 2 — Redis Caching

- [ ] **PR-07** · URL Service — Redis Setup
  - `ioredis` client with retry logic
  - Graceful shutdown, Redis ping on startup
  - _Concepts: cache infrastructure, connection handling_

- [ ] **PR-08** · URL Service — Cache-Aside on Redirect
  - Redirect checks Redis first
  - Cache HIT → return immediately (no DB call)
  - Cache MISS → query DB → store in Redis (TTL 24h) → return
  - Log hit/miss ratio
  - _Concepts: cache-aside pattern, TTL, read performance_

- [ ] **PR-09** · URL Service — Cache Invalidation on Delete
  - Deleting a URL also deletes its Redis key
  - Tests verify stale cache is not served
  - _Concepts: cache invalidation, consistency_

---

## Phase 3 — Authentication

- [ ] **PR-10** · Auth Service — Boilerplate
  - Bare Express server on port `3001`
  - Redis connection (for JWT blacklist), `GET /health`
  - Winston logger
  - _Concepts: service separation, stateless design_

- [ ] **PR-11** · Auth Service — Google OAuth2 + JWT
  - `GET /auth/google` → redirect to Google
  - `GET /auth/google/callback` → exchange code, issue JWT
  - `POST /auth/logout` → blacklist JWT `jti` in Redis
  - `GET /auth/me` → return current user
  - _Concepts: OAuth2 flow, JWT, token blacklisting_

- [ ] **PR-12** · JWT Middleware (Shared)
  - Verify JWT signature
  - Check Redis blacklist (`jti`)
  - Attach `req.user`, return `401` if invalid
  - _Concepts: middleware, stateless auth, distributed session_

- [ ] **PR-13** · URL Service — Protect Routes with Auth
  - `POST /api/urls` → requires JWT
  - `GET /api/urls` → requires JWT, returns only your URLs
  - `DELETE /api/urls/:id` → requires JWT + ownership check
  - `GET /:shortcode` → stays public
  - _Concepts: route guards, authorization, ownership_

---

## Phase 4 — Async Processing

- [ ] **PR-14** · URL Service — RabbitMQ Setup
  - `amqplib` connection + channel
  - `click_events` queue (durable), prefetch count set
  - Reconnect logic, graceful shutdown
  - _Concepts: message queue, AMQP, connection resilience_

- [ ] **PR-15** · URL Service — Publish Click Events
  - After redirect: publish `{ shortcode, ip, userAgent, timestamp, referrer }` to queue
  - Fire-and-forget — does NOT block the redirect response
  - Publish failure logs error but never breaks redirect
  - _Concepts: async messaging, non-blocking I/O, decoupling_

- [ ] **PR-16** · Analytics Worker — Boilerplate + MongoDB
  - Express on port `3003` (health check only)
  - Mongoose connection, `ClickEvent` schema
  - RabbitMQ consumer wired up
  - _Concepts: worker service, event-driven architecture, MongoDB_

- [ ] **PR-17** · Analytics Worker — Consume & Store Events
  - Consume from `click_events` queue
  - Parse userAgent (device, browser detection)
  - Save `ClickEvent` to MongoDB
  - ACK on success, NACK + requeue on failure
  - _Concepts: message consumption, at-least-once delivery, backpressure_

- [ ] **PR-18** · Analytics Service — Stats Endpoints
  - `GET /api/analytics/:shortcode` → clicks, devices, countries for one URL
  - `GET /api/analytics/dashboard` → aggregated stats for authenticated user
  - MongoDB aggregation pipelines
  - _Concepts: eventual consistency, aggregation, read models_

---

## Phase 5 — Rate Limiting

- [ ] **PR-19** · Rate Limiting Middleware
  - Redis token bucket (INCR + TTL pattern)
  - `GET /:shortcode` → 300 req/min per IP
  - `POST /api/urls` → 60 req/min per user
  - Returns `429` with `Retry-After` header
  - _Concepts: rate limiting, backpressure, Redis atomic ops_

---

## Phase 6 — Docker

- [ ] **PR-20** · Dockerfiles for All Services
  - Multi-stage builds (build + production stage)
  - `node:20-alpine` base, non-root user
  - `.dockerignore` per service
  - `HEALTHCHECK` instruction in each Dockerfile
  - _Concepts: containerization, multi-stage builds, image optimization_

- [ ] **PR-21** · Docker Compose — Full Stack
  - All 3 app services + PostgreSQL + Redis + MongoDB + RabbitMQ
  - Shared `app-network`, named volumes
  - `depends_on` with health check conditions
  - RabbitMQ management UI on port `15672`
  - _Concepts: service orchestration, networking, volumes, health checks_

---

## Phase 7 — NGINX Gateway

- [ ] **PR-22** · NGINX Reverse Proxy + Load Balancer
  - `/auth/*` → `auth-service`
  - `/api/*` → `url-service` (round-robin, 3 replicas)
  - `/*` → `url-service` (redirect path)
  - NGINX rate limit zones, upstream health checks
  - Single entry point: `localhost:80`
  - _Concepts: reverse proxy, load balancing, API gateway, horizontal scaling_

---

## Phase 8 — CI/CD

- [ ] **PR-23** · GitHub Actions — CI Pipeline
  - Triggers: push to any branch, PR to `develop`/`main`
  - `npm ci` + `jest` for all 3 services
  - Fail fast if any service fails
  - _Concepts: CI, automated testing, fail fast_

- [ ] **PR-24** · GitHub Actions — CD Pipeline + Environments
  - Triggers: push to `main`
  - Build + tag Docker images with commit SHA
  - Push to GitHub Container Registry (GHCR)
  - Dev / QA / Prod environment configs
  - _Concepts: CD, environment separation, image registry, deployment_

---

## Phase 9 — Kubernetes

- [ ] **PR-25** · K8s Manifests — Infrastructure (Databases)
  - `namespace.yaml`
  - PostgreSQL, Redis, MongoDB, RabbitMQ as StatefulSets
  - PersistentVolumeClaims for all databases
  - ClusterIP Services for internal communication
  - `configmap.yaml` + `secrets.yaml.example`
  - _Concepts: StatefulSets, PVCs, ConfigMaps, Secrets, namespaces_

- [ ] **PR-26** · K8s Manifests — App Services + Traefik Ingress
  - `auth-service`, `url-service` (replicas: 3), `analytics-worker` Deployments
  - Liveness + readiness probes (`/health`)
  - HorizontalPodAutoscaler: `url-service` scales 3→10 on CPU > 70%
  - Traefik `IngressRoute` for external traffic
  - Rolling update strategy (zero downtime)
  - _Concepts: Deployments, HPA, ingress, probes, rolling updates, service discovery_

---

## Phase 10 — Observability

- [ ] **PR-27** · Prometheus + Grafana Metrics
  - Every service exposes `GET /metrics` (prom-client)
  - Tracks: request count, latency p50/p95/p99, cache hit rate, queue depth, error rate
  - `prometheus.yml` scrape config
  - Grafana dashboard JSON
  - Structured JSON logs with request IDs
  - _Concepts: metrics, monitoring, SLIs, dashboards, observability_

- [ ] **PR-28** · Distributed Tracing — OpenTelemetry
  - OpenTelemetry SDK in all 3 services
  - Auto-instrumentation: Express, HTTP, Prisma, Redis, RabbitMQ
  - Trace propagation via HTTP headers across services
  - Exports to Jaeger or Grafana Tempo
  - Trace ID injected into Winston logs (logs ↔ traces linked)
  - _Concepts: distributed tracing, spans, context propagation, correlation IDs_

---

## Concepts Checklist

Track which backend concepts you have actually touched in code:

### Auth & Security
- [ ] OAuth2 flow (PR-11)
- [ ] JWT issuance and verification (PR-11, PR-12)
- [ ] Token blacklisting (PR-11)
- [ ] Route guards / authorization (PR-13)
- [ ] Ownership checks (PR-13)

### State Management
- [ ] Stateless servers (PR-02, PR-10)
- [ ] Distributed sessions via Redis (PR-11, PR-12)
- [ ] Cache-aside caching (PR-08)
- [ ] TTL-based expiry (PR-08)
- [ ] Cache invalidation (PR-09)

### Performance & Scalability
- [ ] Connection pooling — Prisma (PR-03)
- [ ] Caching layer (PR-08)
- [ ] Async processing (PR-15, PR-17)
- [ ] Rate limiting (PR-19)
- [ ] Backpressure via prefetch (PR-17)
- [ ] Horizontal scaling (PR-22, PR-26)
- [ ] Load balancing (PR-22)

### Concurrency & Async
- [ ] Non-blocking I/O — fire and forget (PR-15)
- [ ] Event loop awareness (PR-02)
- [ ] Background worker (PR-16, PR-17)
- [ ] Message queue (PR-14, PR-15, PR-17)
- [ ] ACK / NACK handling (PR-17)

### DevOps
- [ ] Docker basics (PR-20)
- [ ] docker-compose orchestration (PR-21)
- [ ] Health checks (PR-02, PR-20, PR-21)
- [ ] Environment separation (PR-24)
- [ ] CI pipeline (PR-23)
- [ ] CD pipeline (PR-24)

### Kubernetes
- [ ] Pods and Deployments (PR-26)
- [ ] Services and ClusterIP (PR-25)
- [ ] StatefulSets (PR-25)
- [ ] PersistentVolumeClaims (PR-25)
- [ ] ConfigMaps and Secrets (PR-25)
- [ ] Liveness and readiness probes (PR-26)
- [ ] HorizontalPodAutoscaler (PR-26)
- [ ] Ingress with Traefik (PR-26)
- [ ] Rolling updates (PR-26)

### Observability
- [ ] Structured logging — Winston (PR-02)
- [ ] Prometheus metrics (PR-27)
- [ ] Grafana dashboards (PR-27)
- [ ] Distributed tracing — OpenTelemetry (PR-28)
- [ ] Log and trace correlation (PR-28)

### Distributed Systems (Conceptual)
- [ ] Monolith vs Microservices — understood
- [ ] CAP Theorem — understood (PostgreSQL=CP, Redis/Mongo=AP)
- [ ] Eventual consistency — seen in analytics flow
- [ ] Service discovery — seen in K8s
- [ ] API Gateway — implemented via NGINX
- [ ] Kafka vs RabbitMQ — discussed and decided

---

## Notes & Decisions Log

> Add notes here as you build. Capture anything that surprised you, any decision you changed, or any concept that clicked.

```
Date        Note
─────────── ────────────────────────────────────────────────
            (your notes go here)
```

---

> Last updated: Phase 0 — Planning complete. Ready to start PR-01.
