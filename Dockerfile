FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-audit 2>&1 | grep -v 'npm warn deprecated' || true

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder
# Build-time placeholder secrets. These are NOT secrets — they're sentinels
# that the runtime entrypoint refuses to start with. Anything secret baked
# into a Docker image layer can be extracted by `docker save | tar -xO`, so
# real secrets are injected at `docker run` time via env vars / compose.
#
# BUILD_NEXTAUTH_SECRET / BUILD_JWT_SECRET can be overridden with --build-arg
# only if a CI step needs deterministic build output; otherwise leave them
# at the default and the entrypoint will reject them at boot.
ARG BUILD_NEXTAUTH_SECRET=DO_NOT_USE_AT_RUNTIME_REPLACE_VIA_ENV
ARG BUILD_JWT_SECRET=DO_NOT_USE_AT_RUNTIME_REPLACE_VIA_ENV
ENV NEXTAUTH_SECRET=$BUILD_NEXTAUTH_SECRET
ENV JWT_SECRET=$BUILD_JWT_SECRET
ENV NEXTAUTH_URL=http://localhost:3030
# Surface high-severity prod-dep CVEs in the build log so they're impossible
# to miss. `|| true` keeps the build non-fatal — we want visibility, not a
# brittle "your build broke because some transitive moved" pipeline.
RUN npm audit --omit=dev --audit-level=high || true
RUN npm run build

FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3030
CMD ["npm", "run", "dev"]

# IMPORTANT: keep `runner` as the LAST stage so it's the default `target` when
# docker-compose.yml does not specify one. Putting `development` last in the
# past caused prod deploys to silently launch Turbopack dev mode and break
# hydration of client components.
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Entrypoint asserts runtime-required secrets are not the build-time
# placeholders and meet a minimum length before exec'ing node server.js.
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod 755 /app/docker-entrypoint.sh
# Run as the unprivileged `nextjs` user (uid 1001). Combined with
# `read_only: true` in docker-compose.yml, this drops the container's
# write surface to /tmp + named volumes.
USER nextjs
EXPOSE 3030
ENV PORT=3030
ENV HOSTNAME="0.0.0.0"
CMD ["sh", "/app/docker-entrypoint.sh"]
