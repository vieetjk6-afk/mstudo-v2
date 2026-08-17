#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kích hoạt một bản build vừa được đẩy lên VPS. Chạy bằng user `mstudo`.
#
#     deploy/activate.sh <tên-thư-mục-release>
#     ví dụ: activate.sh 2026-08-17-a1b2c3d
#
# GitHub Actions tự gọi script này sau khi rsync xong. Chạy tay cũng được.
#
# Cách hoạt động (kiểu blue-green nhẹ):
#   releases/<A>   ← bản đang chạy
#   releases/<B>   ← bản mới vừa đẩy lên
#   current -> A   → đổi thành B → pm2 reload → kiểm tra sức khoẻ
#                    khoẻ  : xong, dọn bản cũ
#                    không : trỏ current về A, reload lại → trang trở về như cũ
#
# Nhờ vậy một bản build hỏng KHÔNG làm sập trang: xấu nhất là mất ~30 giây.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RELEASE="${1:?Thiếu tên release. Ví dụ: activate.sh 2026-08-17-a1b2c3d}"
BASE="/var/www/mstudo"
RELEASES="$BASE/releases"
NEW="$RELEASES/$RELEASE"
CURRENT="$BASE/current"
SHARED_ENV="$BASE/shared/.env"
KEEP=3 # giữ lại 3 bản gần nhất để còn quay lui

log() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
ok() { printf '\033[0;32m  ✓ %s\033[0m\n' "$*"; }
err() { printf '\033[0;31m  ✗ %s\033[0m\n' "$*"; }

[[ -d "$NEW" ]] || {
	err "Không thấy $NEW"
	exit 1
}
[[ -f "$NEW/server.js" ]] || {
	err "$NEW thiếu server.js — bản build không phải dạng standalone?"
	exit 1
}
[[ -f "$SHARED_ENV" ]] || {
	err "Không thấy $SHARED_ENV. Tạo file này trước (xem deploy/env.vps.example)."
	exit 1
}

# Bản đang chạy, để còn quay lui.
PREV=""
[[ -L "$CURRENT" ]] && PREV="$(basename "$(readlink -f "$CURRENT")")"

# ── Nạp biến môi trường ──────────────────────────────────────────────────────
# pm2 không tự đọc file .env. `set -a` khiến mọi biến gán sau đó tự động được
# export, nên khi gọi pm2 với --update-env thì tiến trình mới nhận được hết.
log "Nạp biến môi trường"
set -a
# shellcheck disable=SC1090
source "$SHARED_ENV"
set +a
: "${SUPABASE_SERVICE_ROLE_KEY:?Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env}"
: "${CRON_SECRET:?Thiếu CRON_SECRET trong .env}"
ok "Đã nạp $(grep -cE '^[A-Z]' "$SHARED_ENV") biến"

# ── Đổi symlink sang bản mới ─────────────────────────────────────────────────
log "Chuyển sang bản $RELEASE"
ln -sfn "$NEW" "$CURRENT.tmp"
mv -Tf "$CURRENT.tmp" "$CURRENT" # đổi tên là thao tác nguyên tử, không có khe hở
ok "current -> $RELEASE"

# ── Khởi động / reload ───────────────────────────────────────────────────────
log "Nạp lại ứng dụng"
if pm2 describe mstudo >/dev/null 2>&1; then
	# reload = chờ tiến trình mới sẵn sàng rồi mới tắt cái cũ (không đứt request)
	pm2 reload "$NEW/deploy/ecosystem.config.cjs" --update-env
else
	pm2 start "$NEW/deploy/ecosystem.config.cjs" --update-env
fi

# ── Kiểm tra sức khoẻ ────────────────────────────────────────────────────────
log "Kiểm tra sức khoẻ (tối đa 60 giây)"
HEALTHY=0
for i in $(seq 1 30); do
	if curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
		HEALTHY=1
		ok "Trang phản hồi sau ${i}0 giây"
		break
	fi
	sleep 2
done

# ── Quay lui nếu hỏng ────────────────────────────────────────────────────────
if [[ $HEALTHY -eq 0 ]]; then
	err "Bản mới KHÔNG phản hồi."
	if [[ -n "$PREV" && -d "$RELEASES/$PREV" && "$PREV" != "$RELEASE" ]]; then
		err "Đang quay về bản cũ: $PREV"
		ln -sfn "$RELEASES/$PREV" "$CURRENT.tmp"
		mv -Tf "$CURRENT.tmp" "$CURRENT"
		pm2 reload "$RELEASES/$PREV/deploy/ecosystem.config.cjs" --update-env || true
		err "Đã quay về $PREV. Xem lỗi bằng: pm2 logs mstudo --lines 100"
	else
		err "Không có bản cũ để quay về. Xem: pm2 logs mstudo --lines 100"
	fi
	exit 1
fi

pm2 save >/dev/null
ok "Đã lưu trạng thái pm2 (tự chạy lại sau khi reboot)"

# ── Dọn bản cũ ───────────────────────────────────────────────────────────────
# VPS ổ nhỏ: mỗi release ~150–250MB, để lâu là đầy ổ. Giữ 3 bản là đủ quay lui.
log "Dọn bản cũ (giữ lại $KEEP bản)"
cd "$RELEASES"
ls -1t | tail -n "+$((KEEP + 1))" | while read -r old; do
	[[ "$old" == "$RELEASE" ]] && continue
	rm -rf -- "$old"
	echo "  đã xoá $old"
done

log "XONG — đang chạy bản $RELEASE"
df -h "$BASE" | tail -1 | awk '{print "  Ổ đĩa: đã dùng "$3" / "$2" ("$5")"}'
free -h | awk '/^Mem:/ {print "  RAM:   đã dùng "$3" / "$2}'
