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
docker compose build
docker compose up -d
docker image prune -f >/dev/null
echo "✔ Đang chạy bản $(git rev-parse --short HEAD). Kiểm tra: docker compose ps"
