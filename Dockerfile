# --- Stage 1: dependencies (for Prisma generation) ---
    FROM node:20-alpine AS deps
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY prisma ./prisma
    RUN npx prisma generate
    
    # --- Stage 2: build the TypeScript code ---
    FROM node:20-alpine AS build
    WORKDIR /app
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    RUN npm run build
    
    # --- Stage 3: production runner ---
    FROM node:20-alpine AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    
    COPY package*.json ./
    RUN npm ci --omit=dev && npm cache clean --force
    
    # Copy Prisma client + built app
    COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
    COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
    COPY --from=build /app/dist ./dist
    
    EXPOSE 3000
    CMD ["node", "dist/src/main.js"]
    