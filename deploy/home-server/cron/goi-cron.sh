#!/bin/sh
# goi-cron.sh <cờ> <đường-dẫn>  — gọi MỘT route cron của app, nếu cờ đang bật.
#   <cờ> : tên biến bật/tắt (HOME_CRON_CLEANUP, HOME_CRON_DAILY…)
#   vd   : goi-cron.sh HOME_CRON_CLEANUP /api/cron/cleanup-proofs
. /run/cron.env
set -u

co="$1"; duong_dan="$2"
eval "bat=\${$co:-false}"
[ "$bat" = "true" ] || exit 0

base="${APP_URL:-http://app:3000}"
ma=$(curl -sS -o /tmp/cron-ra.json -w '%{http_code}' --max-time 330 \
       -H "Authorization: Bearer ${CRON_SECRET}" "${base}${duong_dan}" || echo "000")
# Chỉ in mã + 300 ký tự đầu: đủ chẩn đoán, không đổ cả thân JSON ra log.
echo "[cron] $(date '+%F %T') ${duong_dan} → ${ma} $(head -c 300 /tmp/cron-ra.json 2>/dev/null | tr '\n' ' ')"
