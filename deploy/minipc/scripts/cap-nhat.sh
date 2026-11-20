#!/usr/bin/env bash
# Cập nhật mstudo lên bản mới nhất của nhánh main rồi build + chạy lại.
#   ~/mstudo-v2/deploy/minipc/scripts/cap-nhat.sh
# Build mới XONG mới thay container, nên thời gian gián đoạn chỉ vài giây.
set -euo pipefail
cd "$(dirname "$0")/../../.."          # gốc repo
BRANCH="${1:-main}"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git merge --ff-only "origin/$BRANCH"
cd deploy/minipc
export GIT_SHA="$(git rev-parse HEAD)"
# Chỉ chạy lại đúng các dịch vụ ĐANG chạy: giai đoạn thử chưa bật cron thì
# cập nhật cũng không tự bật cron (tránh gửi tin nhắc trùng với Vercel).
RUNNING="$(docker compose ps --services --status running | tr '\n' ' ')"
docker compose build
if [[ -n "${RUNNING// /}" ]]; then
  # shellcheck disable=SC2086
  docker compose up -d $RUNNING
else
  docker compose up -d
fi
docker image prune -f >/dev/null
echo "✔ Đang chạy bản $(git rev-parse --short HEAD). Kiểm tra: docker compose ps"
