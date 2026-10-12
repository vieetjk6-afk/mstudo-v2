#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# CẬP NHẬT MÁY CHỦ Ở NHÀ — kéo mã mới, dựng lại image, chạy lại, dọn image cũ.
#
#   cd /opt/mstudo/deploy/home-server && ./cap-nhat.sh
#
# Tuỳ chọn:
#   ./cap-nhat.sh --khong-pull    dựng lại từ mã đang có, không `git pull`
#
# Chạy lại bao nhiêu lần cũng được. Trong lúc dựng (~5–15 phút), container cũ
# VẪN chạy; chỉ khi image mới xong mới đổi sang — gián đoạn chỉ vài giây, và
# trong vài giây đó trang trên Vercel tự lùi về chính nó (không ai thấy hỏng).
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail

THU_MUC_DEPLOY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GOC_REPO="$(cd "$THU_MUC_DEPLOY/../.." && pwd)"
cd "$THU_MUC_DEPLOY"

xanh() { printf '\033[1;32m%s\033[0m\n' "$*"; }
vang() { printf '\033[1;33m%s\033[0m\n' "$*"; }
do_() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; }
buoc() { printf '\n\033[1;36m━━ %s\033[0m\n' "$*"; }

KEO_MA=1
[ "${1:-}" = "--khong-pull" ] && KEO_MA=0

# ── Kiểm tra trước ──────────────────────────────────────────────────────────
if ! docker info >/dev/null 2>&1; then
  do_ "Không gọi được Docker. Đã đăng xuất/đăng nhập lại sau cai-dat.sh chưa? (hoặc chạy bằng sudo)"
  exit 1
fi
if [ ! -f .env ]; then
  do_ "Chưa có $THU_MUC_DEPLOY/.env — chạy:  cp .env.example .env && nano .env"
  exit 1
fi
# Đọc vài biến từ .env để in và kiểm tra (không `source` cả file: giá trị lạ có thể vỡ shell).
# `|| true`: biến vắng mặt thì grep thoát 1, và với `set -euo pipefail` một phép
# gán từ lệnh hỏng là dừng cả script — mà "vắng mặt" là câu trả lời hợp lệ ở đây.
doc_bien() { { grep -E "^$1=" .env || true; } | tail -n1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//"; }
for bien in TUNNEL_TOKEN CRON_SECRET NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  if [ -z "$(doc_bien "$bien")" ]; then
    do_ "Biến $bien trong .env đang TRỐNG — điền rồi chạy lại."
    exit 1
  fi
done
MEDIA_HOST="$(doc_bien MEDIA_HOST)"

# ── 1. Kéo mã mới ───────────────────────────────────────────────────────────
buoc "1/5 Kéo mã mới"
if [ "$KEO_MA" = 1 ]; then
  truoc="$(git -C "$GOC_REPO" rev-parse --short HEAD)"
  git -C "$GOC_REPO" pull --ff-only
  sau="$(git -C "$GOC_REPO" rev-parse --short HEAD)"
  if [ "$truoc" = "$sau" ]; then xanh "Không có commit mới ($sau) — vẫn dựng lại cho chắc."; else xanh "$truoc → $sau"; fi
else
  vang "Bỏ qua git pull (--khong-pull)."
fi
# /api/version sẽ báo đúng commit này.
GIT_COMMIT_SHA="$(git -C "$GOC_REPO" rev-parse HEAD)"
export GIT_COMMIT_SHA

# ── 2. Soi biến NEXT_PUBLIC_* trước khi dựng (chúng bị nướng vào bản dựng) ───
buoc "2/5 Soi biến môi trường"
# Dùng đúng script mà CI của Vercel dùng; chạy trong container node nên máy chủ
# không cần cài Node.
if ! docker run --rm -v "$GOC_REPO:/w:ro" -w /w node:22-bookworm-slim \
       node scripts/kiem-tra-bien.mjs deploy/home-server/.env; then
  do_ "Biến môi trường có lỗi (xem dòng ❌ ở trên). Sửa .env rồi chạy lại."
  exit 1
fi

# ── 3. Dựng image ───────────────────────────────────────────────────────────
buoc "3/5 Dựng image (lần đầu lâu nhất; các lần sau dùng cache)"
docker compose pull cloudflared
docker compose build --pull

# ── 4. Chạy ─────────────────────────────────────────────────────────────────
buoc "4/5 Khởi động lại các container"
docker compose up -d --remove-orphans
# Image cũ (không còn tag) và cache build quá 7 ngày — để SSD 512 GB không đầy dần.
docker image prune -f >/dev/null
docker builder prune -f --filter "until=168h" >/dev/null || true
xanh "Đã dọn image cũ."

# ── 5. Sức khoẻ ─────────────────────────────────────────────────────────────
buoc "5/5 Kiểm tra sức khoẻ"
trang_thai=""
for _ in $(seq 1 40); do
  id_app="$(docker compose ps -q app)"
  trang_thai="$(docker inspect -f '{{.State.Health.Status}}' "$id_app" 2>/dev/null || echo "?")"
  [ "$trang_thai" = "healthy" ] && break
  sleep 3
done
docker compose ps
if [ "$trang_thai" != "healthy" ]; then
  do_ "app chưa healthy sau 2 phút (trạng thái: $trang_thai). Xem log:  docker compose logs --tail 100 app"
  exit 1
fi
xanh "app: healthy"
docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/version').then(r=>r.text()).then(t=>console.log('   nội bộ  →', t))"
if [ -n "$MEDIA_HOST" ]; then
  # Đi đường vòng qua Internet → Cloudflare → tunnel → app: kiểm luôn cả tunnel.
  if ra="$(curl -fsS --max-time 15 "https://$MEDIA_HOST/api/version")"; then
    xanh "   qua tunnel → $ra"
  else
    vang "   Chưa gọi được https://$MEDIA_HOST/api/version qua Internet."
    vang "   Xem:  docker compose logs --tail 50 cloudflared   (và Public Hostname trong Cloudflare)"
  fi
fi
xanh "Cập nhật xong."
