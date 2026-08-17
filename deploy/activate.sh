#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kích hoạt một bản build vừa được đẩy lên VPS. Chạy bằng user `mstudo`.
#
#     deploy/activate.sh <tên-thư-mục-release>
#     ví dụ: activate.sh 20260817-093000-a1b2c3d
#
# GitHub Actions tự gọi script này sau khi rsync xong. Chạy tay cũng được.
#
# Cách hoạt động (blue-green nhẹ):
#   releases/<A>   ← bản đang chạy
#   releases/<B>   ← bản mới vừa đẩy lên
#   current -> A   → đổi sang B → restart → kiểm tra sức khoẻ
#                    khoẻ  : xong, dọn bản cũ
#                    không : trỏ current về A, restart lại → trang trở về như cũ
#
# Bản build hỏng KHÔNG làm sập trang. Next.js standalone boot ~76ms và Caddy
# giữ request tới 15 giây (lb_try_duration), nên khách gần như không thấy gì.
#
# ── VỀ QUYỀN ────────────────────────────────────────────────────────────────
# Script này chạy bằng user thường, KHÔNG phải root. Nó chỉ được phép làm đúng
# một việc cần quyền cao: `sudo systemctl restart mstudo` (setup-vps.sh đã cấp
# riêng quyền đó, không cần mật khẩu).
#
# Cố ý KHÔNG cho script tự cập nhật /etc/systemd/system/mstudo.service. Nếu cho
# phép, bất kỳ ai đẩy được code lên VPS đều có thể sửa unit file thành
# `ExecStart=/bin/sh` rồi restart — tức là leo thẳng lên quyền root. Unit file
# hiếm khi đổi; khi đổi thì chép tay bằng root (xem docs mục 11.3).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RELEASE="${1:?Thiếu tên release. Ví dụ: activate.sh 20260817-093000-a1b2c3d}"
BASE="/var/www/mstudo"
RELEASES="$BASE/releases"
NEW="$RELEASES/$RELEASE"
CURRENT="$BASE/current"
SHARED_ENV="$BASE/shared/.env"
UNIT="mstudo"
KEEP=3 # giữ 3 bản gần nhất để còn quay lui

log() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
ok() { printf '\033[0;32m  ✓ %s\033[0m\n' "$*"; }
err() { printf '\033[0;31m  ✗ %s\033[0m\n' "$*"; }

healthy() { curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1; }

# Tên release do CI sinh ra, nhưng vẫn kiểm tra để không ai truyền vào "../..".
[[ "$RELEASE" =~ ^[A-Za-z0-9._-]+$ ]] || { err "Tên release không hợp lệ: $RELEASE"; exit 1; }

# ── Kiểm tra trước khi động vào gì ───────────────────────────────────────────
[[ -d "$NEW" ]] || { err "Không thấy $NEW"; exit 1; }
[[ -f "$NEW/server.js" ]] || { err "$NEW thiếu server.js — bản build không phải dạng standalone?"; exit 1; }
[[ -d "$NEW/.next/static" ]] || { err "$NEW thiếu .next/static — trang sẽ mất sạch CSS. Dừng."; exit 1; }
[[ -d "$NEW/public" ]] || { err "$NEW thiếu public/ — mất logo và ảnh. Dừng."; exit 1; }
[[ -f "$SHARED_ENV" ]] || { err "Không thấy $SHARED_ENV. Tạo trước (xem deploy/env.vps.example)."; exit 1; }

# Vài biến sống còn — thiếu là app vẫn chạy nhưng hỏng âm thầm.
for v in SUPABASE_SERVICE_ROLE_KEY CRON_SECRET NEXT_PUBLIC_SUPABASE_URL; do
	grep -qE "^${v}=.+" "$SHARED_ENV" || { err "Thiếu $v trong $SHARED_ENV"; exit 1; }
done

# ── Kiểm tra định dạng .env theo luật systemd ────────────────────────────────
# systemd đọc file này bằng EnvironmentFile, KHÔNG phải bash. Nó KHÔNG báo lỗi
# khi gặp dòng sai — nó lặng lẽ bỏ qua dòng đó. Hậu quả: app khởi động bình
# thường rồi hỏng ở một tính năng nào đó, và không có gì trong log chỉ ra
# nguyên nhân. Nên chặn ngay tại đây.
BAD=0
while IFS= read -r line || [[ -n "$line" ]]; do
	[[ -z "${line// /}" || "$line" =~ ^[[:space:]]*# ]] && continue
	case "$line" in
		export\ *)   err ".env: bỏ chữ 'export' — systemd không hiểu:  $line"; BAD=1 ;;
		*[[:space:]]=*|*=[[:space:]]*)
		             err ".env: không được có dấu cách quanh dấu =:  $line"; BAD=1 ;;
		[A-Za-z_]*=*) : ;;   # hợp lệ
		*)           err ".env: dòng không đúng dạng TÊN=giá trị:  $line"; BAD=1 ;;
	esac
	[[ "$line" == *'${'* ]] && warn_expand=1
done <"$SHARED_ENV"
[[ $BAD -eq 1 ]] && { err "Sửa $SHARED_ENV rồi deploy lại."; exit 1; }
[[ -n "${warn_expand:-}" ]] && printf '\033[0;33m  ! .env có chuỗi ${...} — systemd KHÔNG thay thế biến, nó giữ nguyên ký tự\033[0m\n'

ok "Bản build hợp lệ, .env đúng định dạng systemd"

# Cảnh báo (không chặn) nếu unit file trong repo đã khác bản đang cài.
if ! cmp -s "$NEW/deploy/mstudo.service" "/etc/systemd/system/$UNIT.service" 2>/dev/null; then
	printf '\033[0;33m  ! deploy/mstudo.service khác bản đang cài. Muốn áp dụng thì chạy bằng root:\033[0m\n'
	printf '\033[0;33m      sudo cp %s/deploy/mstudo.service /etc/systemd/system/ && sudo systemctl daemon-reload\033[0m\n' "$CURRENT"
fi

# Bản đang chạy, để còn quay lui.
PREV=""
[[ -L "$CURRENT" ]] && PREV="$(basename "$(readlink -f "$CURRENT")")"

# ── Đổi symlink sang bản mới ─────────────────────────────────────────────────
log "Chuyển sang bản $RELEASE"
ln -sfn "$NEW" "$CURRENT.tmp"
mv -Tf "$CURRENT.tmp" "$CURRENT" # đổi tên là thao tác nguyên tử, không có khe hở
ok "current -> $RELEASE"

# ── Khởi động lại ────────────────────────────────────────────────────────────
log "Khởi động lại dịch vụ"
sudo -n systemctl restart "$UNIT"

# ── Kiểm tra sức khoẻ ────────────────────────────────────────────────────────
log "Kiểm tra sức khoẻ (tối đa 60 giây)"
HEALTHY=0
for i in $(seq 1 30); do
	if healthy; then
		HEALTHY=1
		ok "Trang phản hồi sau $((i * 2)) giây"
		break
	fi
	sleep 2
done

# ── Quay lui nếu hỏng ────────────────────────────────────────────────────────
if [[ $HEALTHY -eq 0 ]]; then
	err "Bản mới KHÔNG phản hồi."
	journalctl -u "$UNIT" -n 30 --no-pager 2>/dev/null | sed 's/^/    /' || true

	if [[ -n "$PREV" && -d "$RELEASES/$PREV" && "$PREV" != "$RELEASE" ]]; then
		err "Đang quay về bản cũ: $PREV"
		ln -sfn "$RELEASES/$PREV" "$CURRENT.tmp"
		mv -Tf "$CURRENT.tmp" "$CURRENT"
		sudo -n systemctl restart "$UNIT" || true
		sleep 5
		if healthy; then
			err "Đã quay về $PREV — trang chạy lại bình thường. Bản $RELEASE giữ nguyên để bạn xem lỗi."
		else
			err "QUAY LUI CŨNG HỎNG. Vào máy xử lý tay: journalctl -u $UNIT -n 100"
		fi
	else
		err "Không có bản cũ để quay về. Xem: journalctl -u $UNIT -n 100"
	fi
	exit 1
fi

# ── Dọn bản cũ ───────────────────────────────────────────────────────────────
# Mỗi release ~55MB. Giữ 3 bản là đủ quay lui mà không đầy ổ.
# KHÔNG bao giờ xoá bản đang chạy hoặc bản liền trước, kể cả khi KEEP nhỏ.
log "Dọn bản cũ (giữ lại $KEEP bản)"
cd "$RELEASES"
ls -1t | tail -n "+$((KEEP + 1))" | while read -r old; do
	[[ "$old" == "$RELEASE" || "$old" == "$PREV" ]] && continue
	rm -rf -- "$old"
	echo "  đã xoá $old"
done

log "XONG — đang chạy bản $RELEASE"
df -h "$BASE" | tail -1 | awk '{print "  Ổ đĩa: đã dùng "$3" / "$2" ("$5")"}'
free -h | awk '/^Mem:/ {print "  RAM:   đã dùng "$3" / "$2}'
