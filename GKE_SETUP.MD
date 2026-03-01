# GKE Setup Guide

## What Is GKE Autopilot

GKE Autopilot is Google's managed Kubernetes service.
You do not manage any servers — Google handles everything.
You just deploy your apps and pay for what you use.

```
Traditional Kubernetes:
  → you manage the machines (nodes)
  → you patch them, scale them, monitor them
  → complex, time consuming

GKE Autopilot:
  → Google manages the machines
  → you only manage your apps
  → much simpler
  → pay per pod, not per machine
```

---

## Step 1 — Create A Google Cloud Account

```
1. Go to cloud.google.com
2. Sign up — you get $300 free credit
3. Create a new project:
   GCP Console → Select Project → New Project
   Name: url-shortener
   Note your Project ID (e.g. url-shortener-123456)
```

---

## Step 2 — Create GKE Autopilot Cluster

```
GCP Console → Kubernetes Engine → Create Cluster
  → Select: Autopilot (not Standard)
  → Name: url-shortener-cluster
  → Region: europe-west1 (closest to you in Frankfurt)
  → Click Create

Takes about 5 minutes to provision.
```

Or via gcloud CLI:
```bash
gcloud container clusters create-auto url-shortener-cluster \
  --region=europe-west1 \
  --project=YOUR_PROJECT_ID
```

---

## Step 3 — Create Service Account For GitHub Actions

GitHub Actions needs permission to deploy to your cluster.

```
GCP Console → IAM & Admin → Service Accounts → Create Service Account
  Name: github-actions-deployer
  Description: Used by GitHub Actions to deploy to GKE

Add these roles:
  → Kubernetes Engine Developer
  → Artifact Registry Reader (if using Google Artifact Registry)

Click Done
```

Create a key:
```
Click the service account → Keys → Add Key → JSON
Download the JSON file
```

Base64 encode it:
```bash
base64 -i downloaded-key.json | tr -d '\n'
```

Copy the output — this is your `GKE_SA_KEY` secret.

---

## Step 4 — Add GitHub Secrets

Go to your GitHub repo:
```
Settings → Secrets and variables → Actions → New repository secret
```

Add these secrets:
```
GKE_PROJECT_ID     → your GCP project ID (e.g. url-shortener-123456)
GKE_CLUSTER_NAME   → url-shortener-cluster
GKE_CLUSTER_ZONE   → europe-west1
GKE_SA_KEY         → the base64 encoded service account JSON from Step 3
```

Also add your app secrets (used to create Kubernetes secrets in the pipeline):
```
DATABASE_URL          → your Neon connection string
REDIS_URL             → your Upstash Redis URL
RABBITMQ_URL          → your CloudAMQP URL
MONGODB_URI           → your MongoDB Atlas URI
JWT_ACCESS_SECRET     → your JWT access secret (32+ chars)
JWT_REFRESH_SECRET    → your JWT refresh secret (32+ chars)
GOOGLE_CLIENT_ID      → your Google OAuth client ID
GOOGLE_CLIENT_SECRET  → your Google OAuth client secret
```

---

## Step 5 — Install NGINX Ingress Controller

The ingress.yaml needs an NGINX ingress controller running in the cluster.

```bash
# Connect to your cluster
gcloud container clusters get-credentials url-shortener-cluster \
  --region=europe-west1 \
  --project=YOUR_PROJECT_ID

# Install NGINX ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Wait for it to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# Get the external IP address
kubectl get service ingress-nginx-controller \
  --namespace=ingress-nginx
```

Note the EXTERNAL-IP — this is your cluster's public IP address.

---

## Step 6 — Update configmap.yaml With Your Domain

Once you have the external IP:

```
Option A — Use the IP directly (no domain needed)
  BASE_URL: http://EXTERNAL_IP
  ALLOWED_ORIGIN: http://EXTERNAL_IP
  GOOGLE_CALLBACK_URL: http://EXTERNAL_IP/auth/google/callback

Option B — Use a real domain
  Point your domain DNS to the EXTERNAL_IP
  BASE_URL: http://yourdomain.com
  ALLOWED_ORIGIN: http://yourdomain.com
  GOOGLE_CALLBACK_URL: http://yourdomain.com/auth/google/callback
```

Also update `k8s/ingress/ingress.yaml`:
```yaml
spec:
  rules:
    - host: EXTERNAL_IP  # or your domain
```

---

## Step 7 — Deploy

Push to main branch:
```bash
git add .
git commit -m "feat: PR-26 — deploy to GKE"
git push origin main
```

Watch the pipeline:
```
GitHub → Actions → Docker Build & Push → completes
GitHub → Actions → CD Deploy to GKE → triggers automatically
```

---

## Step 8 — Verify Deployment

```bash
# Connect to cluster
gcloud container clusters get-credentials url-shortener-cluster \
  --region=europe-west1

# Check all pods are running
kubectl get pods -n url-shortener

# Expected output:
# NAME                                  READY   STATUS    RESTARTS
# auth-service-xxx                      1/1     Running   0
# url-service-xxx-1                     1/1     Running   0
# url-service-xxx-2                     1/1     Running   0
# url-service-xxx-3                     1/1     Running   0
# analytics-worker-xxx                  1/1     Running   0
# analytics-service-xxx                 1/1     Running   0

# Test the app
curl http://EXTERNAL_IP/health
curl http://EXTERNAL_IP/auth/google
```

---

## Estimated Cost

```
GKE Autopilot pricing (europe-west1):
  CPU:    $0.0445 per vCPU per hour
  Memory: $0.0049 per GB per hour

Our cluster at minimum:
  auth-service      0.1 vCPU, 128Mi
  url-service x3    0.6 vCPU, 768Mi
  analytics-worker  0.1 vCPU, 128Mi
  analytics-service 0.1 vCPU, 128Mi

Estimated: ~$15-25/month
Free $300 credit = ~12 months free
```

---

## Useful Commands

```bash
# View all pods
kubectl get pods -n url-shortener

# View logs for a service
kubectl logs -n url-shortener -l app=url-service --tail=100

# View logs live
kubectl logs -n url-shortener -l app=url-service -f

# Describe a pod (useful for debugging)
kubectl describe pod POD_NAME -n url-shortener

# Check HPA status
kubectl get hpa -n url-shortener

# Force restart a deployment
kubectl rollout restart deployment/url-service -n url-shortener

# Check ingress
kubectl get ingress -n url-shortener
```
