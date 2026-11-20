#!/bin/sh
# crond của busybox KHÔNG truyền biến môi trường cho job, nên ghi CRON_SECRET
# và APP_URL ra file chỉ root đọc được rồi để goi.sh đọc lại.
set -eu
if [ -z "${CRON_SECRET:-}" ]; then
  echo "[cron] THIẾU CRON_SECRET trong .env — dừng." >&2
  exit 1
fi
umask 077
mkdir -p /run/mstudo
printf '%s' "$CRON_SECRET" > /run/mstudo/secret
printf '%s' "${APP_URL:-http://mstudo:3000}" > /run/mstudo/url
mkdir -p /etc/crontabs
cp /cron/crontab /etc/crontabs/root
echo "[cron] đã nạp lịch:"; grep -v '^#' /etc/crontabs/root | sed '/^$/d'
exec crond -f -l 6
