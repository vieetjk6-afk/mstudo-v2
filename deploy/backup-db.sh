#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sao lưu cơ sở dữ liệu.
#
#     deploy/backup-db.sh
#
# ⚠️ ĐỌC KỸ: Supabase cloud tự sao lưu hộ bạn. Một khi TỰ DỰNG Supabase trên
#    VPS thì KHÔNG CÒN AI làm việc đó. Ổ cứng hỏng, xoá nhầm một câu SQL, hay
#    VPS bị nhà cung cấp thu hồi — mất là mất trắng: hợp đồng, khách hàng, ảnh
#    cưới của người ta. Bật cron cho script này NGAY trong ngày đầu tự dựng DB.
#
# ⚠️ Bản sao lưu nằm CÙNG Ổ ĐĨA với dữ liệu gốc thì không phải là sao lưu.
#    Hãy bật phần đẩy ra nơi khác (rclone) ở cuối file.
#
# Cần: postgresql-client (apt install postgresql-client)
# Cần biến DATABASE_URL trong /var/www/mstudo/shared/.env, dạng:
#     DATABASE_URL='postgresql://postgres:<mật-khẩu>@127.0.0.1:5432/postgres'
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

ENV_FILE="/var/www/mstudo/shared/.env"
BACKUP_DIR="/var/backups/mstudo"
KEEP_DAYS=14
# Đặt tên remote của rclone vào đây để bật đẩy sao lưu ra ngoài (vd "b2:mstudo-backup").
# Để trống = chỉ lưu trên chính VPS này (KHÔNG an toàn, xem cảnh báo ở trên).
REMOTE="${BACKUP_REMOTE:-}"

STAMP="$(date +%Y%m%d-%H%M)"
say() { echo "[$(date '+%F %T')] $*"; }

[[ -f "$ENV_FILE" ]] || {
	say "LỖI: không thấy $ENV_FILE"
	exit 1
}

DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' ')"
if [[ -z "$DATABASE_URL" ]]; then
	say "Bỏ qua: chưa có DATABASE_URL (vẫn đang dùng Supabase cloud — họ tự sao lưu)."
	exit 0
fi

command -v pg_dump >/dev/null || {
	say "LỖI: chưa có pg_dump. Cài: sudo apt install postgresql-client"
	exit 1
}

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/mstudo-$STAMP.sql.gz"

# ── Đổ dữ liệu ───────────────────────────────────────────────────────────────
# Ghi ra file .tmp rồi mới đổi tên: nếu pg_dump chết giữa chừng, ta không để lại
# một file .sql.gz cụt trông như bản sao lưu hợp lệ — thứ chỉ phát hiện ra vào
# đúng lúc cần khôi phục.
say "Bắt đầu sao lưu…"
if pg_dump "$DATABASE_URL" \
	--no-owner --no-privileges --clean --if-exists \
	| gzip -9 >"$OUT.tmp"; then
	mv "$OUT.tmp" "$OUT"
	say "Xong: $OUT ($(du -h "$OUT" | cut -f1))"
else
	rm -f "$OUT.tmp"
	say "LỖI: pg_dump thất bại — KHÔNG có bản sao lưu hôm nay"
	exit 1
fi

# ── Kiểm tra file đọc được ───────────────────────────────────────────────────
# Sao lưu không kiểm tra là sao lưu chỉ tồn tại trên giấy.
if ! gzip -t "$OUT"; then
	say "LỖI: file sao lưu hỏng, đã xoá"
	rm -f "$OUT"
	exit 1
fi

# ── Đẩy ra nơi khác ──────────────────────────────────────────────────────────
if [[ -n "$REMOTE" ]]; then
	if command -v rclone >/dev/null; then
		if rclone copy "$OUT" "$REMOTE/"; then
			say "Đã đẩy lên $REMOTE"
		else
			say "CẢNH BÁO: đẩy lên $REMOTE thất bại — bản sao lưu chỉ còn nằm trên VPS"
		fi
	else
		say "CẢNH BÁO: chưa cài rclone, bỏ qua bước đẩy ra ngoài"
	fi
else
	say "CẢNH BÁO: chưa đặt BACKUP_REMOTE — bản sao lưu nằm cùng ổ với dữ liệu gốc."
fi

# ── Dọn bản cũ ───────────────────────────────────────────────────────────────
find "$BACKUP_DIR" -name 'mstudo-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
say "Đang giữ $(find "$BACKUP_DIR" -name 'mstudo-*.sql.gz' | wc -l) bản sao lưu"
