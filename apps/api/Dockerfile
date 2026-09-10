# =============================================================================
# Production image for the Baagly API.
#
# Multi-stage on purpose: the build stage needs the whole toolchain (TypeScript,
# Nest CLI, every devDependency) but none of that should ship. The final image
# carries only compiled JavaScript, production dependencies and the generated
# Prisma client.
# =============================================================================

# --- Stage 1: install every dependency, including dev ------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: generate the Prisma client and compile TypeScript --------------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- Stage 3: production dependencies only -----------------------------------
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# The Prisma client is generated code, not a published package, so it has to be
# regenerated against the pruned tree rather than copied from the build stage.
COPY prisma ./prisma
RUN npx prisma generate

# --- Stage 4: the image that actually runs -----------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

# Postgres client tools are used by the entrypoint to wait for the database,
# and tini gives the container a real init so SIGTERM reaches Node.
RUN apk add --no-cache tini postgresql-client

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Uploaded photos live here. Declared as a volume so a rebuild or redeploy
# cannot wipe them — losing this directory is what left every listing showing
# "Photo unavailable" once already.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
VOLUME ["/app/uploads"]

# Never run as root: a bug in an upload handler should not be able to touch
# anything outside the app.
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
