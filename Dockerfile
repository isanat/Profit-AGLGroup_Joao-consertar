# ============================================================================
# InvestFlow — production image
# Single-origin: Express API server also serves the built Vite SPA.
# Frontend uses relative /api/... URLs, so no CORS/base-url config needed.
# ============================================================================
FROM node:24-bookworm-slim AS base

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini git \
 && rm -rf /var/lib/apt/lists/*

# pnpm 9 (matches lockfileVersion 9.0)
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# ---------------------------------------------------------------------------
# Install dependencies (cached layer)
# ---------------------------------------------------------------------------
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY tsconfig.base.json tsconfig.json ./
COPY artifacts/ ./artifacts/
COPY lib/ ./lib/
COPY scripts/ ./scripts/

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Build frontend (Vite) — requires PORT + BASE_PATH at build time
# ---------------------------------------------------------------------------
ENV NODE_ENV=production
ENV PORT=20001
ENV BASE_PATH=/
RUN pnpm --filter @workspace/investflow run build

# ---------------------------------------------------------------------------
# Build API server (esbuild -> dist/index.mjs)
# ---------------------------------------------------------------------------
RUN pnpm --filter @workspace/api-server run build

# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Runtime configuration
ENV NODE_ENV=production
ENV PORT=8080
ENV PUBLIC_DIR=/app/artifacts/investflow/dist/public
ENV SEED_ON_START=true

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
