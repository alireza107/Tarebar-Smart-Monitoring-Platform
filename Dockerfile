# Stage 1 — production dependencies (Prisma CLI lives here, not in devDependencies)
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

# Stage 2 — build
FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_VIDEO_ANALYTICS_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_FRUIT_PIPELINE_API_URL=http://localhost:8010
ARG NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL=http://localhost:8889
ARG NEXT_PUBLIC_MEDIAMTX_HLS_URL=http://localhost:8888
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_VIDEO_ANALYTICS_API_URL=$NEXT_PUBLIC_VIDEO_ANALYTICS_API_URL \
    NEXT_PUBLIC_FRUIT_PIPELINE_API_URL=$NEXT_PUBLIC_FRUIT_PIPELINE_API_URL \
    NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL=$NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL \
    NEXT_PUBLIC_MEDIAMTX_HLS_URL=$NEXT_PUBLIC_MEDIAMTX_HLS_URL
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# Stage 3 — production runtime
FROM node:20-alpine AS runner
WORKDIR /app
ARG VERSION=dev
LABEL org.opencontainers.image.title="tarebar-frontend" \
      org.opencontainers.image.version="${VERSION}"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat openssl \
    && addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
