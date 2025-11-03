# === 1) Install all deps & generate Prisma Client ===
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate   # generate client at build-time

# === 2) Build (needs devDependencies: @nestjs/cli, typescript, etc.) ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY prisma ./prisma
RUN npm run build         # nest build

# === 3) Production deps only (no dev) ===
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev     # install production deps

# === 4) Runtime image (no migrate/seed) ===
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Prod node_modules
COPY --from=prod-deps /app/node_modules ./node_modules
# Prisma Client artifacts
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

# App artifacts
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
