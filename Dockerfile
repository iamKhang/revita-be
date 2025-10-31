# === 1) Install deps & generate Prisma Client (with dev deps) ===
FROM node:20-alpine AS deps
WORKDIR /app

# Copy manifests & install all deps (cần dev deps để prisma generate)
COPY package*.json ./
RUN npm ci

# Copy Prisma schema và generate client
COPY prisma ./prisma
RUN npx prisma generate

# Prune dev deps để node_modules gọn cho production
RUN npm prune --omit=dev

# === 2) Build TypeScript (NestJS) ===
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
# Reuse node_modules (đã có @prisma/client đã generate)
COPY --from=deps /app/node_modules ./node_modules

COPY src ./src
COPY prisma ./prisma
RUN npm run build

# === 3) Runtime image (no migrate/seed) ===
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Lấy node_modules đã prune + prisma binaries/client
COPY --from=deps /app/node_modules ./node_modules
# (Tùy chọn) copy prisma/ để tiện debug, không bắt buộc
COPY prisma ./prisma

# App artifacts
COPY --from=builder /app/dist ./dist
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
