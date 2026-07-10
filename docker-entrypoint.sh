#!/bin/sh
set -e

echo "=============================================="
echo " InvestFlow — starting container"
echo " NODE_ENV=${NODE_ENV}"
echo " PORT=${PORT:-8080}"
echo " PUBLIC_DIR=${PUBLIC_DIR}"
echo "=============================================="

# ---------------------------------------------------------------------------
# 1. Wait for the database & push schema (drizzle) with retries
# ---------------------------------------------------------------------------
if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] WARNING: DATABASE_URL is not set — skipping schema push."
else
  ATTEMPTS=0
  MAX_ATTEMPTS=30
  until [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; do
    ATTEMPTS=$((ATTEMPTS + 1))
    echo "[entrypoint] Pushing DB schema (attempt ${ATTEMPTS}/${MAX_ATTEMPTS})..."
    if pnpm --filter @workspace/db run push < /dev/null; then
      echo "[entrypoint] Schema push OK."
      break
    fi
    echo "[entrypoint] Schema push failed — DB may not be ready yet. Retrying in 3s..."
    sleep 3
  done

  if [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; then
    echo "[entrypoint] Could not push schema after ${MAX_ATTEMPTS} attempts. Exiting."
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 2. Seed default data (idempotent — only inserts missing records)
# ---------------------------------------------------------------------------
if [ "${SEED_ON_START}" = "true" ]; then
  echo "[entrypoint] Seeding database (idempotent)..."
  pnpm --filter @workspace/api-server run seed || {
    echo "[entrypoint] Seed failed (non-fatal, continuing)."
  }
else
  echo "[entrypoint] SEED_ON_START != true — skipping seed."
fi

# ---------------------------------------------------------------------------
# 3. Start the API server (also serves the built frontend)
# ---------------------------------------------------------------------------
echo "[entrypoint] Starting API server on port ${PORT:-8080}..."
exec node --enable-source-maps /app/artifacts/api-server/dist/index.mjs
