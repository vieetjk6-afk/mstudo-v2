# syntax=docker/dockerfile:1.7
#
# Image chạy mstudo trên máy tự host (minipc). Build từ GỐC repo:
#   docker compose -f deploy/minipc/docker-compose.yml build
# (compose đã đặt context = gốc repo). Hướng dẫn: deploy/minipc/HUONG-DAN.md

ARG NODE_IMAGE=node:22-bookworm-slim

# ── 1. Cài thư viện ─────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
# postinstall cần script chép mô hình; nó dễ tính nên thiếu public/ vẫn qua.
COPY scripts ./scripts
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ── 2. Build Next ở chế độ standalone ──────────────────────────────────────
FROM deps AS builder
COPY . .
# Biến NEXT_PUBLIC_* được NHÚNG vào mã trình duyệt lúc build — phải có ở đây,
# đặt ở runtime là đã muộn. Compose truyền chúng vào từ deploy/minipc/.env.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_MAIN_HOST
ARG NEXT_PUBLIC_APP_HOST
ARG NEXT_PUBLIC_IMG_HOST
ARG NEXT_PUBLIC_ADMIN_HOST
ARG NEXT_PUBLIC_THIEP_HOST
ARG NEXT_PUBLIC_STUDIO_HOST
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_GOOGLE_API_KEY
ARG NEXT_PUBLIC_GOOGLE_APP_ID
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_IMG_DIRECT
ARG NEXT_PUBLIC_FACE_SEARCH
ARG NEXT_PUBLIC_SEPAY_REF_URL
ARG NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL
ARG NEXT_PUBLIC_DESKTOP_RELEASES_REPO
ARG GIT_SHA=""
# Bước type-check của repo này cần ~4 GB heap; mặc định của Node thấp hơn
# nên build chết vì "JavaScript heap out of memory". Máy 8 GB RAM: hạ xuống
# 3072 và tạo thêm swap (xem HUONG-DAN.md mục 5.2).
ARG BUILD_HEAP_MB=6144
ENV NEXT_OUTPUT=standalone \
    VERCEL_GIT_COMMIT_SHA=${GIT_SHA} \
    NODE_OPTIONS=--max-old-space-size=${BUILD_HEAP_MB}
RUN npm run build

# ── 3. Image chạy: chỉ server.js + phần node_modules thật sự cần ────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Tạo sẵn thư mục cache thuộc user node: volume gắn vào đây thừa hưởng quyền
# của nó. Thiếu bước này Next báo EACCES mỗi lần ghi cache.
RUN mkdir -p .next/cache && chown node:node .next/cache
# Không chạy bằng root.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ── (tuỳ chọn) Tiến trình nghe Zalo cá nhân → hộp thư hợp nhất ─────────────
FROM ${NODE_IMAGE} AS zalo-worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY scripts/zalo-inbox-worker.mjs ./scripts/
USER node
CMD ["node", "scripts/zalo-inbox-worker.mjs"]
