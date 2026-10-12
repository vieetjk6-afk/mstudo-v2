# syntax=docker/dockerfile:1.7
#
# MÁY CHỦ Ở NHÀ — image của app Next.js (bản dựng "máy media").
#
# Dựng từ GỐC REPO (context ../..), docker-compose.yml lo việc đó:
#   cd /opt/mstudo/deploy/home-server && docker compose build
#
# Ba tầng:
#   deps    → npm ci (đủ devDependencies để build; zca-js là optionalDependency
#             nên npm ci cài luôn). `postinstall` chạy scripts/chep-mediapipe.mjs
#             nên phải chép script đó vào TRƯỚC khi npm ci.
#   builder → `npm run build` với BUILD_STANDALONE=1 + MEDIA_ONLY=1 (xem
#             next.config.mjs). `prebuild` chạy chep-mediapipe --required: thiếu
#             WASM MediaPipe là build ĐỎ ngay, không ra image thiếu tài sản.
#   runner  → chỉ .next/standalone (server.js + node_modules đã trace, gồm trọng
#             số face-api + .wasm + supabase/*.sql nhờ outputFileTracingIncludes)
#             + public/ + .next/static chép tay theo tài liệu output.md của Next.
#
# Node 22: repo chạy dev trên 22, test dùng --experimental-strip-types của 22, và
# Node 20 (bản CI đang ghim) đã hết hạn hỗ trợ từ 30/04/2026.
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    # devDependency `playwright` chỉ dùng cho script chụp giao diện — đừng tải trình duyệt.
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Cache npm dùng chung giữa các lần dựng; `sharing=locked` vì hai tầng deps và
# worker-deps chạy SONG SONG — hai tiến trình npm ghi chung một cache là hỏng.
# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY scripts/chep-mediapipe.mjs ./scripts/chep-mediapipe.mjs
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund

# ── worker-deps ───────────────────────────────────────────────────────────────
# Worker Zalo là script Node RIÊNG, không qua bundler của Next. Trong standalone
# có zca-js (route Zalo import nó lúc chạy, nft trace theo) nhưng KHÔNG có
# @supabase/supabase-js (Next đã gói nó vào chunk của server). Nên cài riêng hai
# gói đó, ĐÚNG phiên bản trong package-lock.json, vào scripts/node_modules —
# Node tìm ở đó trước khi tìm /app/node_modules của standalone, hai bên không đè nhau.
FROM base AS worker-deps
WORKDIR /worker
COPY package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    node -e "const l=require('./package-lock.json').packages; \
      const d=Object.fromEntries(['@supabase/supabase-js','zca-js'].map(n=>[n,l['node_modules/'+n].version])); \
      console.log('worker deps:', d); \
      require('fs').writeFileSync('package.json', JSON.stringify({name:'zalo-worker',private:true,dependencies:d}))" \
 && npm install --omit=dev --no-audit --no-fund --ignore-scripts

# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
ENV BUILD_STANDALONE=1 \
    MEDIA_ONLY=1 \
    # Bước kiểm kiểu của `next build` vượt ~2 GB heap mặc định (xem vercel-deploy.yml).
    NODE_OPTIONS=--max-old-space-size=4096
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Biến NEXT_PUBLIC_* bị NƯỚNG vào bundle lúc build, nên build phải thấy .env.
# Gắn .env dưới dạng BuildKit secret, đặt tên `.env.production.local`: Next VẪN
# nạp file này lúc build, nhưng KHÔNG chép nó vào .next/standalone (Next chỉ chép
# `.env` và `.env.production`) → bí mật không nằm lại trong image hay layer nào.
RUN --mount=type=secret,id=dotenv,target=/app/.env.production.local \
    npm run build \
 && test -f .next/standalone/server.js \
 && n=$(find .next/standalone/node_modules/@vladmandic/face-api/model -type f | wc -l) \
 && echo "Trọng số face-api trong standalone: $n file" \
 && [ "$n" -ge 14 ] \
 && ls .next/standalone/node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm >/dev/null \
 && ls .next/standalone/supabase/kiem-tra.json >/dev/null

# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
ARG GIT_COMMIT_SHA=""
ENV NODE_ENV=production \
    PORT=3000 \
    # Docker đặt HOSTNAME = id container; server.js của Next nghe theo biến này,
    # nên phải ép về 0.0.0.0, không thì cloudflared/cron không gọi tới được.
    HOSTNAME=0.0.0.0 \
    BUILD_STANDALONE=1 \
    MEDIA_ONLY=1 \
    DEPLOY_ENV=home-server \
    GIT_COMMIT_SHA=${GIT_COMMIT_SHA}

# Người dùng `node` (uid 1000) có sẵn trong image chính thức — KHÔNG chạy root.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Worker Zalo chạy từ CÙNG image (service `zalo-worker`), với node_modules riêng
# ở scripts/ (tầng worker-deps) — dòng RUN cuối kiểm nó import được thật.
COPY --from=builder --chown=node:node /app/scripts/zalo-inbox-worker.mjs ./scripts/zalo-inbox-worker.mjs
COPY --from=worker-deps --chown=node:node /worker/node_modules ./scripts/node_modules
RUN cd scripts && node --input-type=module -e "await import('@supabase/supabase-js'); await import('zca-js'); console.log('worker deps: ok')"
# Thư mục cache của Next (ảnh tối ưu, fetch cache) — tạo sẵn và giao cho `node`,
# để volume `next-cache` gắn vào đây nhận đúng chủ sở hữu ở lần tạo đầu tiên.
RUN mkdir -p .next/cache && chown node:node .next/cache

USER node
EXPOSE 3000

# /api/version: không chạm DB, không chạm Google — rẻ nhất để biết server còn sống.
# slim không có curl → dùng chính fetch() của Node.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
