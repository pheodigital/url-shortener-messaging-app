# 🔗 URL Shortener + Analytics Platform

A production-grade URL Shortener built to learn and practice **core backend engineering concepts** — from OAuth2 and caching to microservices, Kubernetes, and observability.

> This is not just a toy project. Every technology choice mirrors real-world backend decisions made at scale.

---

## 🎯 Project Goal

Build a fully functional URL shortener (like bit.ly) that covers:

- Authentication (OAuth2 + JWT)
- Caching & Session Management (Redis)
- Async Processing (RabbitMQ)
- Microservices Architecture
- Containerization (Docker)
- Orchestration (Kubernetes)
- Observability (Prometheus, Grafana, OpenTelemetry)
- CI/CD (GitHub Actions)

---

## 🚀 What The App Does

| Feature       | Description                                                               |
| ------------- | ------------------------------------------------------------------------- |
| Shorten URL   | User submits a long URL → gets back a short code (e.g. `short.ly/abc123`) |
| Redirect      | Anyone visits the short URL → instantly redirected to original            |
| Analytics     | Dashboard shows clicks, timestamps, locations, devices                    |
| Auth          | Login with Google (OAuth2), protected routes via JWT                      |
| Rate Limiting | Prevent abuse — X requests per IP per minute                              |

---

## 🏗️ Services

The app is split into **3 independent microservices**:

```
┌─────────────────┐    ┌─────────────────┐    ┌──────────────────────┐
│  Auth Service   │    │   URL Service   │    │  Analytics Worker    │
│   PORT: 3001    │    │   PORT: 3002    │    │   PORT: 3003         │
│                 │    │                 │    │                      │
│ Google OAuth2   │    │ Create URLs     │    │ Consumes RabbitMQ    │
│ JWT Tokens      │    │ Redirect        │    │ Stores click events  │
│ Session (Redis) │    │ Redis Cache     │    │ Aggregates stats     │
└─────────────────┘    └─────────────────┘    └──────────────────────┘
```

---

## 🛠️ Tech Stack

### Core

| Layer      | Technology     | Why                                                           |
| ---------- | -------------- | ------------------------------------------------------------- |
| Language   | Node.js 20 LTS | Non-blocking I/O, event loop, great for I/O-heavy services    |
| Framework  | Express.js     | Minimal, widely used, great for learning routing + middleware |
| Validation | Zod            | Schema validation, type-safe, clean error messages            |

### Databases

| Layer            | Technology    | Why                                                      |
| ---------------- | ------------- | -------------------------------------------------------- |
| Primary DB       | PostgreSQL 16 | ACID transactions, relational data (users, URLs)         |
| ORM              | Prisma        | Modern ORM, clean schema, auto migrations                |
| Cache + Sessions | Redis 7       | Sub-millisecond reads, TTL support, distributed sessions |
| Analytics        | MongoDB 7     | Flexible schema for event data, fast writes              |
| ODM              | Mongoose      | Schema + model layer for MongoDB                         |

### Auth

| Layer  | Technology              | Why                                          |
| ------ | ----------------------- | -------------------------------------------- |
| OAuth2 | passport-google-oauth20 | Industry-standard Google login               |
| Tokens | jsonwebtoken (JWT)      | Stateless auth, no session storage on server |

### Messaging

| Layer         | Technology | Why                                           |
| ------------- | ---------- | --------------------------------------------- |
| Message Queue | RabbitMQ 3 | Decouple click tracking from redirect (async) |
| Client        | amqplib    | Node.js RabbitMQ client                       |

### Infrastructure

| Layer         | Technology              | Why                                                         |
| ------------- | ----------------------- | ----------------------------------------------------------- |
| Reverse Proxy | NGINX                   | Load balancing, rate limiting, gateway                      |
| K8s Ingress   | Traefik                 | Modern ingress controller (ingress-nginx retiring Mar 2026) |
| Containers    | Docker + Docker Compose | Reproducible environments                                   |
| Orchestration | Kubernetes (Minikube)   | Production-grade container management                       |

### Observability

| Layer   | Technology           | Why                                          |
| ------- | -------------------- | -------------------------------------------- |
| Logging | Winston              | Structured JSON logs, multiple transports    |
| Metrics | Prometheus + Grafana | Monitor request rates, latency, errors       |
| Tracing | OpenTelemetry        | Trace a single request across all 3 services |

### Dev & CI/CD

| Layer          | Technology       | Why                                      |
| -------------- | ---------------- | ---------------------------------------- |
| Short codes    | nanoid           | Fast, URL-safe unique ID generation      |
| Testing        | Jest + Supertest | Unit + integration tests                 |
| CI/CD          | GitHub Actions   | Automated test + build + deploy pipeline |
| Env management | dotenv           | Per-environment config (dev/qa/prod)     |

---

## ❌ What We Deliberately Excluded

| Technology    | Reason                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| TypeScript    | Keeping focus on backend concepts, not type systems                     |
| Kafka         | RabbitMQ teaches the same async concepts; Kafka discussed theoretically |
| GraphQL       | REST is sufficient; avoids unnecessary complexity                       |
| WebSockets    | No real-time push needed; polling is fine for analytics dashboard       |
| Sequelize     | Prisma has better DX for learning                                       |
| Istio         | Too advanced; K8s networking is enough                                  |
| ingress-nginx | Retiring March 2026 — replaced with Traefik                             |

---

## 📁 Project Structure

```
url-shortener/
├── services/
│   ├── auth-service/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── controllers/
│   │   │   ├── config/
│   │   │   └── index.js
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── package.json
│   │
│   ├── url-service/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── controllers/
│   │   │   ├── prisma/
│   │   │   │   └── schema.prisma
│   │   │   ├── config/
│   │   │   └── index.js
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── analytics-worker/
│       ├── src/
│       │   ├── consumers/
│       │   ├── models/
│       │   ├── config/
│       │   └── index.js
│       ├── Dockerfile
│       ├── .env.example
│       └── package.json
│
├── nginx/
│   └── nginx.conf
│
├── k8s/
│   ├── auth-service.yaml
│   ├── url-service.yaml
│   ├── analytics-worker.yaml
│   ├── postgres.yaml
│   ├── redis.yaml
│   ├── mongodb.yaml
│   ├── rabbitmq.yaml
│   └── traefik-ingress.yaml
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── docker-compose.yml
├── README.md
├── system_design.md
└── architecture.md
```

---

## 🔢 Build Phases

| Phase  | What We Build      | Concepts Covered                             |
| ------ | ------------------ | -------------------------------------------- |
| **1**  | URL Service (CRUD) | Express, PostgreSQL, Prisma, REST API        |
| **2**  | Redis Caching      | Cache hit/miss, TTL, cache invalidation      |
| **3**  | Auth Service       | Google OAuth2, JWT, stateless sessions       |
| **4**  | Analytics Worker   | RabbitMQ, async processing, MongoDB          |
| **5**  | Rate Limiting      | Middleware, Redis counters, backpressure     |
| **6**  | Docker             | Dockerfile, docker-compose, networking       |
| **7**  | NGINX Gateway      | Reverse proxy, load balancing                |
| **8**  | CI/CD              | GitHub Actions, environment separation       |
| **9**  | Kubernetes         | Pods, services, deployments, Traefik ingress |
| **10** | Observability      | Prometheus, Grafana, OpenTelemetry tracing   |

---

## 🏃 Quick Start (added as phases complete)

```bash
# Clone the repo
git clone https://github.com/yourname/url-shortener.git
cd url-shortener

# Start all services
docker-compose up --build

# Services available at:
# NGINX Gateway  → http://localhost:80
# Auth Service   → http://localhost:3001
# URL Service    → http://localhost:3002
# Analytics      → http://localhost:3003
# RabbitMQ UI    → http://localhost:15672
# Grafana        → http://localhost:3000
```

---

## 📚 Concepts Covered (Full List)

**Auth:** OAuth2, JWT, Stateless Auth, Token Blacklisting

**State Management:** Stateless Servers, Distributed Sessions, Redis Caching, Cache Invalidation, TTL

**Performance:** Vertical vs Horizontal Scaling, Load Balancing, Connection Pooling, Caching Layers, Async Processing, Rate Limiting, Backpressure

**Concurrency:** Event Loop, Blocking vs Non-Blocking I/O, Background Jobs, Message Queues

**DevOps:** Docker, docker-compose, Kubernetes, CI/CD, Environment Separation, Health Checks

**Observability:** Structured Logging, Metrics, Distributed Tracing

**Distributed Systems:** Microservices, CAP Theorem (discussed), Eventual Consistency, API Gateway, Service Discovery

---

```markdown
## 📚 Architecture FAQ: Analytics, RabbitMQ, and MongoDB

### What Each Service Does

| Service               | Purpose                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| **url-service**       | Handles redirects (GET /:shortcode) — the HOT PATH, hit millions of times            |
| **analytics-worker**  | Background worker that listens to RabbitMQ and saves click events to MongoDB         |
| **analytics-service** | HTTP API that reads from MongoDB and serves stats (totalClicks, topUserAgents, etc.) |

### Why Not Save Directly to MongoDB on Every Redirect?

**The Problem:**

- MongoDB write takes ~20-50ms per operation
- At scale (10,000 clicks/second), direct writes cause overwhelm
- Result: slow redirects, poor user experience

**The Core Issue:**
The redirect is the most critical operation — it must complete in under 5ms to maintain a snappy user experience.

### Why RabbitMQ is the Solution

**How it works:**

1. User clicks short URL → url-service handles it
2. url-service publishes to RabbitMQ (~1ms, fire-and-forget)
3. url-service returns 302 immediately to user
4. analytics-worker picks up the message asynchronously and writes to MongoDB

**Performance Impact:**

- **With RabbitMQ:** redirect = cache/DB lookup (~2-10ms) + analytics async (~0ms to user)
- **Without RabbitMQ:** redirect = DB lookup + MongoDB write (~60ms) — user waits

**Resilience Benefit:**
If MongoDB goes down, redirects keep working perfectly — click events queue up in RabbitMQ and drain when MongoDB recovers. No data loss.

### Why Separate analytics-worker and analytics-service?

**Separation of concerns:**

- **analytics-worker** → only writes to MongoDB (heavy I/O)
- **analytics-service** → only reads from MongoDB (HTTP API)

**Benefits:**

- Scale write and read loads independently
- One service crashing doesn't affect the other
- Foundation of event-driven microservice architecture (used at Twitter, Uber, LinkedIn)
```

---

> Built for learning. Designed like production.
