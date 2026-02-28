# ─── Stage 1: Builder ────────────────────────────────────
# Install all dependencies and compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first — Docker caches this layer
# Only re-runs npm install if package.json changes
COPY package*.json ./

RUN npm ci

# Copy source and compile
COPY . .
RUN npm run build

# ─── Stage 2: Production ─────────────────────────────────
# Fresh image — no TypeScript compiler, no dev dependencies
# Results in a much smaller final image
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Run as non-root user for security
USER node

EXPOSE 3003

CMD ["node", "dist/index.js"]