FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Install all deps (including dev) to run Prisma CLI
RUN npm ci
# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install deps (include dev for ts-node + prisma CLI at runtime when needed)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Bring in Prisma generated artifacts
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema/migrations for runtime migrations
COPY prisma ./prisma

# Copy already-built dist from repository (avoids TS compile in container)
COPY dist ./dist

# Entrypoint script to run migrations/seed if DB empty
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]


