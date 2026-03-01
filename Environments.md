# GitHub Environments Setup Guide

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
