# Stage 1: Build TypeScript -> dist/
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "node dist/database/run-migrations.js && node dist/main.js"]
