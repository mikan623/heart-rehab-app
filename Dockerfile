#
# Next.js (App Router) + Prisma (Postgres) for ECS/Fargate
# - Exposes and runs on PORT=3002
# - Uses multi-stage build (deps -> build -> runtime)
#

FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Prisma needs OpenSSL on Debian slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# postinstall(prisma generate) は schema 未配置だと失敗するため抑止
RUN npm ci --ignore-scripts


FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Build-time env for Next.js public variables
ARG NEXT_PUBLIC_LIFF_ID
ENV NEXT_PUBLIC_LIFF_ID=$NEXT_PUBLIC_LIFF_ID

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build includes prisma generate via npm script
RUN npm run build


FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package.json package-lock.json ./
# postinstall(prisma generate) は schema 未配置だと失敗するため、先に抑止してから明示的に generate する
RUN npm ci --omit=dev --ignore-scripts

# Copy build output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client in runtime image (no DB needed)
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 3002
CMD ["npm","run","start","--","-p","3002"]

