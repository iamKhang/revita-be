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

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Bring in Prisma generated artifacts
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

# Copy already-built dist from repository (avoids TS compile in container)
COPY dist ./dist

EXPOSE 3000
CMD ["node", "dist/src/main.js"]


