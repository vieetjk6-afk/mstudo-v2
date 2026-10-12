#!/bin/sh
# Khởi động container cron.
#
# busybox crond chạy job với môi trường TRỐNG — không thấy biến của docker
# compose. Nên lúc khởi động ta ghi đúng những biến job cần vào một file chỉ
# root đọc được, và mỗi job tự nạp file đó.
set -eu

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[cron] THIẾU CRON_SECRET trong .env — mọi lượt gọi sẽ bị app trả 401. Dừng." >&2
  exit 1
fi

umask 077
{
  for v in CRON_SECRET APP_URL HOME_CRON_FACE_SCAN HOME_CRON_CLEANUP HOME_CRON_DAILY FACE_SCAN_ROUNDS FACE_SCAN_MAX_TIME TZ; do
    eval "val=\${$v:-}"
    # Bọc trong nháy đơn, thoát nháy đơn bên trong — giá trị lạ cũng không vỡ.
    printf "export %s='%s'\n" "$v" "$(printf %s "$val" | sed "s/'/'\\\\''/g")"
  done
} > /run/cron.env

echo "[cron] Bắt đầu. Gọi app tại ${APP_URL:-http://app:3000}."
echo "[cron]   quét khuôn mặt mỗi 10 phút : ${HOME_CRON_FACE_SCAN:-true}"
echo "[cron]   dọn dẹp hằng ngày (idempotent): ${HOME_CRON_CLEANUP:-false}"
echo "[cron]   việc GỬI TIN hằng ngày      : ${HOME_CRON_DAILY:-false}"
# -f: chạy nền trước (PID 1 của container); -L /dev/stdout: log của crond ra
# `docker compose logs cron` (mặc định nó ghi vào syslog — container không có).
exec crond -f -l 6 -L /dev/stdout
