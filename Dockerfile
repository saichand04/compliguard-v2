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
ENV NEXTAUTH_SECRET=build-time-placeholder-secret-32-chars
ENV NEXTAUTH_URL=http://localhost:3030
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
USER nextjs
EXPOSE 3030
ENV PORT=3030
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
