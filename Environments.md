# GitHub Environments Setup Guide

---

## What Is GHCR

GHCR stands for **GitHub Container Registry**.

Think of it like a **storage locker for Docker images** — but the locker is built directly into GitHub.

### What It Does

```
You write code
  → GitHub Actions builds a Docker image
  → Docker image gets stored in GHCR
  → Your server pulls the image from GHCR
  → Server runs the image as a container
```

### Why GHCR Instead Of Docker Hub

```
Docker Hub (what we had before):
  → Separate account needed
  → Free tier has pull rate limits
  → Need to manage DOCKERHUB_USERNAME + DOCKERHUB_TOKEN secrets
  → Your images live at: hub.docker.com/r/pheodigital/url-service

GHCR (what we switched to):
  → Built into GitHub — no separate account
  → Uses GITHUB_TOKEN which is automatic — no secrets to manage
  → No pull rate limits for private repos
  → Your images live at: ghcr.io/pheodigital/url-service
  → Images linked directly to your GitHub repo
```

### Real World Analogy

```
Docker Hub  → like storing your files on Dropbox
              works fine but separate login, separate service

GHCR        → like storing your files on Google Drive
              when you already use Gmail
              everything is in one place, one login, works together
```

### What The Image Address Looks Like

```
Docker Hub:   pheodigital/url-service:latest
GHCR:         ghcr.io/pheodigital/url-service:latest

The only difference is the prefix ghcr.io
```

In short — GHCR is Docker Hub but built into GitHub. Since we are already using GitHub for everything, it makes sense to keep images there too.

---

## What Are GitHub Environments

GitHub Environments let you control how and when deployments happen.
Each environment (dev, qa, prod) has its own:
- Secrets (server credentials)
- Protection rules (who can approve)
- Deployment history

---

## Step 1 — Create Environments

Go to your GitHub repo:
```
Settings → Environments → New environment
```

Create three environments:
```
dev   → no protection rules (deploys automatically)
qa    → no protection rules (manual trigger only)
prod  → add Required reviewers (must be approved before deploy)
```

---

## Step 2 — Add Secrets To Each Environment

For each environment add these secrets:
```
SERVER_HOST    → IP address of your server (e.g. 142.250.1.1)
SERVER_USER    → SSH username (e.g. ubuntu)
SERVER_SSH_KEY → private SSH key content (the full key including BEGIN/END lines)
```

How to add:
```
Settings → Environments → dev → Add secret
```

---

## Step 3 — How Deployments Work

```
Push to main branch
  → CI runs tests (ci.yml)
  → Docker images built + pushed to GHCR (docker.yml)
  → Auto deploy to dev (cd.yml triggered by workflow_run)

Manual deploy to qa:
  GitHub → Actions → CD Deploy → Run workflow
  Environment: qa
  Image tag: sha-abc1234 (or latest)

Manual deploy to prod:
  GitHub → Actions → CD Deploy → Run workflow
  Environment: prod
  Image tag: sha-abc1234
  → GitHub pauses and waits for approval
  → Reviewer approves in GitHub UI
  → Deployment proceeds
```

---

## Step 4 — Server Setup

Your server needs Docker and docker-compose installed:
```bash
# On your server
sudo apt update
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker $USER

# Clone your repo
git clone https://github.com/your-username/url-shortener.git ~/url-shortener

# Create .env files for each service
cp services/url-service/.env.example services/url-service/.env
# Fill in real values for each .env file
```

---

## Image Tags Explained

```
latest        → always the most recent build from main
               good for dev — always up to date

sha-abc1234   → specific commit — immutable
               good for qa and prod — you know exactly what is deployed
               if prod breaks you know which commit to rollback to
```

---

## Rollback

If prod breaks after a deploy:
```
GitHub → Actions → CD Deploy → Run workflow
Environment: prod
Image tag: sha-previousgoodcommit

This deploys the previous known good image
No code changes needed — just redeploy the old image
```
