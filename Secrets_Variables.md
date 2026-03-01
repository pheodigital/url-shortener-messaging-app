# Secrets & Variables — Complete Reference

## How GitHub Secrets Work

```
Repository Secrets   → available to ALL workflows, ALL environments
                       set once, used everywhere

Environment Secrets  → available ONLY to that specific environment
                       dev secrets only available when deploying to dev
                       prod secrets only available when deploying to prod

Repository Variables → same as secrets but not masked in logs
                       use for non-sensitive config like project IDs
```

---

## Where To Configure Each Type

```
Repository Secrets:
  GitHub → Settings → Secrets and variables → Actions → Repository secrets

Environment Secrets:
  GitHub → Settings → Environments → dev/qa/prod → Add secret

Local Development:
  services/each-service/.env (never commit this file)
```

---
---

# SECTION 1 — GitHub Repository Secrets
### Used by ALL workflows (ci.yml, docker.yml, cd.yml)

```
Settings → Secrets and variables → Actions → Repository secrets
```

| Secret | Value | Used By | Where To Get It |
|--------|-------|---------|-----------------|
| `DOCKERHUB_USERNAME` | pheodigital | docker.yml (old) | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | dckr_pat_... | docker.yml (old) | Docker Hub → Account Settings → Security → Access Token |
| `GKE_PROJECT_ID` | url-shortener-123456 | cd.yml | GCP Console → Project ID |
| `GKE_CLUSTER_NAME` | url-shortener-cluster | cd.yml | GCP Console → Kubernetes Engine |
| `GKE_CLUSTER_ZONE` | europe-west1 | cd.yml | Where you created the cluster |
| `GKE_SA_KEY` | base64 JSON | cd.yml | GCP → IAM → Service Accounts → Key → base64 encode |

> Note: DOCKERHUB_USERNAME and DOCKERHUB_TOKEN are no longer needed after switching to GHCR. GITHUB_TOKEN is automatic.

---
---

# SECTION 2 — GitHub Environment Secrets
### Set separately for dev, qa, and prod

```
Settings → Environments → [dev or qa or prod] → Add secret
```

## 2A — SSH Deploy Secrets (used BEFORE Kubernetes)
> These were used in the old cd.yml with SSH + docker-compose.
> After switching to GKE (PR-26) these are no longer needed.
> Keeping here for reference if you ever deploy to a plain server.

| Secret | Value | Description |
|--------|-------|-------------|
| `SERVER_HOST` | 142.250.1.1 | IP address of your server |
| `SERVER_USER` | ubuntu | SSH username on the server |
| `SERVER_SSH_KEY` | -----BEGIN... | Full private SSH key content |

Add these to each environment that has a server:
```
dev  → SERVER_HOST, SERVER_USER, SERVER_SSH_KEY (dev server IP)
qa   → SERVER_HOST, SERVER_USER, SERVER_SSH_KEY (qa server IP)
prod → SERVER_HOST, SERVER_USER, SERVER_SSH_KEY (prod server IP)
```

---

## 2B — App Secrets (used in cd.yml to create Kubernetes secrets)
> These are your real service credentials.
> Add to EACH environment with the appropriate values.
> dev uses dev/test databases, prod uses production databases.

| Secret | dev Value | prod Value | Where To Get It |
|--------|-----------|------------|-----------------|
| `DATABASE_URL` | Neon dev branch URL | Neon main branch URL | neon.tech → your project → Connection Details |
| `REDIS_URL` | Upstash dev database | Upstash prod database | console.upstash.com → Connect |
| `RABBITMQ_URL` | CloudAMQP dev instance | CloudAMQP prod instance | cloudamqp.com → your instance → AMQP URL |
| `MONGODB_URI` | Atlas dev cluster | Atlas prod cluster | mongodb.com/atlas → Connect → Drivers |
| `JWT_ACCESS_SECRET` | any 32+ char string | strong random secret | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | any 32+ char string | strong random secret | same as above |
| `GOOGLE_CLIENT_ID` | same for all envs | same for all envs | console.cloud.google.com → Credentials |
| `GOOGLE_CLIENT_SECRET` | same for all envs | same for all envs | console.cloud.google.com → Credentials |

---
---

# SECTION 3 — Local Development .env Files
### Never committed to Git — one file per service

```
Each service has:
  .env          → your real local values (gitignored)
  .env.example  → template committed to Git
```

---

## 3A — auth-service/.env

```bash
# ── Server ───────────────────────────────────────────────
NODE_ENV=development
PORT=3001

# ── Database (Neon) ──────────────────────────────────────
# neon.tech → your project → Connection Details → Connection string
DATABASE_URL=postgresql://username:password@host/dbname

# ── Google OAuth ─────────────────────────────────────────
# console.cloud.google.com → APIs & Services → Credentials
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# ── JWT ──────────────────────────────────────────────────
# Must match JWT_ACCESS_SECRET in url-service and analytics-service
JWT_ACCESS_SECRET=your-access-secret-minimum-32-characters
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your-refresh-secret-minimum-32-characters
JWT_REFRESH_EXPIRES_IN=7d

# ── CORS ─────────────────────────────────────────────────
ALLOWED_ORIGIN=http://localhost:3000
```

---

## 3B — url-service/.env

```bash
# ── Server ───────────────────────────────────────────────
NODE_ENV=development
PORT=3002
BASE_URL=http://localhost:80

# ── Database (Neon) ──────────────────────────────────────
# Same database as auth-service
DATABASE_URL=postgresql://username:password@host/dbname

# ── Redis (Upstash) ──────────────────────────────────────
# console.upstash.com → your database → Connect → Node.js
REDIS_URL=redis://default:password@host:port

# ── RabbitMQ (CloudAMQP) ─────────────────────────────────
# cloudamqp.com → your instance → AMQP details → URL
RABBITMQ_URL=amqps://llxkzdci:password@dog.lmq.cloudamqp.com/llxkzdci
RABBITMQ_QUEUE_CLICK_EVENTS=click_events

# ── JWT ──────────────────────────────────────────────────
# Must be IDENTICAL to auth-service JWT_ACCESS_SECRET
JWT_ACCESS_SECRET=your-access-secret-minimum-32-characters

# ── Rate Limiting (optional — defaults shown) ─────────────
RATE_LIMIT_REDIRECT_RPM=300
RATE_LIMIT_API_RPM=60
```

---

## 3C — analytics-worker/.env

```bash
# ── Server ───────────────────────────────────────────────
NODE_ENV=development

# ── MongoDB (Atlas) ──────────────────────────────────────
# mongodb.com/atlas → Connect → Drivers → Node.js → Connection string
MONGODB_URI=mongodb+srv://analytics:password@cluster.mongodb.net/analytics

# ── RabbitMQ (CloudAMQP) ─────────────────────────────────
# Same as url-service — must connect to the same broker
RABBITMQ_URL=amqps://llxkzdci:password@dog.lmq.cloudamqp.com/llxkzdci
RABBITMQ_QUEUE_CLICK_EVENTS=click_events
RABBITMQ_PREFETCH_COUNT=10
```

---

## 3D — analytics-service/.env

```bash
# ── Server ───────────────────────────────────────────────
NODE_ENV=development
PORT=3003

# ── MongoDB (Atlas) ──────────────────────────────────────
# Same cluster as analytics-worker
MONGODB_URI=mongodb+srv://analytics:password@cluster.mongodb.net/analytics

# ── JWT ──────────────────────────────────────────────────
# Must be IDENTICAL to auth-service JWT_ACCESS_SECRET
JWT_ACCESS_SECRET=your-access-secret-minimum-32-characters

# ── CORS ─────────────────────────────────────────────────
ALLOWED_ORIGIN=http://localhost:3000
```

---
---

# SECTION 4 — Kubernetes ConfigMap
### Non-sensitive config — committed to Git
### File: k8s/configmap.yaml

| Key | Value | Used By |
|-----|-------|---------|
| `NODE_ENV` | production | all services |
| `AUTH_SERVICE_PORT` | 3001 | auth-service |
| `URL_SERVICE_PORT` | 3002 | url-service |
| `ANALYTICS_SERVICE_PORT` | 3003 | analytics-service |
| `BASE_URL` | http://your-domain.com | url-service |
| `ALLOWED_ORIGIN` | http://your-domain.com | auth-service, analytics-service |
| `RABBITMQ_QUEUE_CLICK_EVENTS` | click_events | url-service, analytics-worker |
| `RABBITMQ_PREFETCH_COUNT` | 10 | analytics-worker |
| `CACHE_TTL_SECONDS` | 86400 | url-service |
| `RATE_LIMIT_REDIRECT_RPM` | 300 | url-service |
| `RATE_LIMIT_API_RPM` | 60 | url-service |
| `JWT_ACCESS_EXPIRES_IN` | 1d | auth-service |
| `JWT_REFRESH_EXPIRES_IN` | 7d | auth-service |
| `GOOGLE_CALLBACK_URL` | http://your-domain.com/auth/google/callback | auth-service |

> Update BASE_URL, ALLOWED_ORIGIN, and GOOGLE_CALLBACK_URL to your real domain after getting the GKE external IP.

---

# SECTION 5 — Kubernetes Secrets
### Sensitive config — NEVER committed to Git
### Created by cd.yml directly from GitHub environment secrets

| Secret Key | GitHub Secret Name | Used By |
|------------|-------------------|---------|
| `DATABASE_URL` | `DATABASE_URL` | auth-service, url-service |
| `REDIS_URL` | `REDIS_URL` | url-service |
| `RABBITMQ_URL` | `RABBITMQ_URL` | url-service, analytics-worker |
| `MONGODB_URI` | `MONGODB_URI` | analytics-worker, analytics-service |
| `JWT_ACCESS_SECRET` | `JWT_ACCESS_SECRET` | auth-service, url-service, analytics-service |
| `JWT_REFRESH_SECRET` | `JWT_REFRESH_SECRET` | auth-service |
| `GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_ID` | auth-service |
| `GOOGLE_CLIENT_SECRET` | `GOOGLE_CLIENT_SECRET` | auth-service |

> These are created automatically by cd.yml — you never need to create them manually.

---
---

# SECTION 6 — Shared Values (Must Match Across Services)

These values must be IDENTICAL wherever they are used:

```
JWT_ACCESS_SECRET
  → auth-service    (signs tokens)
  → url-service     (verifies tokens)
  → analytics-service (verifies tokens)
  If these differ → 401 errors everywhere

DATABASE_URL
  → auth-service    (reads/writes users and refresh tokens)
  → url-service     (reads/writes URLs)
  Same Neon database, same connection string

RABBITMQ_URL
  → url-service     (publishes click events)
  → analytics-worker (consumes click events)
  Must point to the same CloudAMQP instance

RABBITMQ_QUEUE_CLICK_EVENTS
  → url-service     (publishes to this queue)
  → analytics-worker (consumes from this queue)
  Must be the same queue name: click_events

MONGODB_URI
  → analytics-worker  (writes click events)
  → analytics-service (reads click events)
  Must point to the same Atlas cluster and database
```

---
---

# SECTION 7 — Quick Setup Checklist

## Local Development
```
□ Copy .env.example to .env in each service folder
□ Fill in DATABASE_URL (Neon)
□ Fill in REDIS_URL (Upstash)
□ Fill in RABBITMQ_URL (CloudAMQP)
□ Fill in MONGODB_URI (Atlas)
□ Generate JWT_ACCESS_SECRET (32+ chars)
□ Generate JWT_REFRESH_SECRET (32+ chars)
□ Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
□ Verify JWT_ACCESS_SECRET is identical in all 3 services
```

## GitHub (CI/CD)
```
□ Add DOCKERHUB_USERNAME (optional after GHCR switch)
□ Add DOCKERHUB_TOKEN (optional after GHCR switch)
□ Add GKE_PROJECT_ID
□ Add GKE_CLUSTER_NAME
□ Add GKE_CLUSTER_ZONE
□ Add GKE_SA_KEY (base64 encoded service account JSON)
□ Create dev environment → add all app secrets
□ Create qa environment  → add all app secrets
□ Create prod environment → add all app secrets + required reviewers
```

## Kubernetes
```
□ Update k8s/configmap.yaml with real domain/IP
□ Update k8s/ingress/ingress.yaml with real domain/IP
□ Update GOOGLE_CALLBACK_URL in configmap.yaml
□ Add k8s/secrets.yaml to .gitignore
□ Secrets are created automatically by cd.yml
```
