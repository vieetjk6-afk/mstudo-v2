#!/bin/sh
# Gọi một route cron của app, kèm Bearer CRON_SECRET. Dùng tay để chạy thử:
#   docker compose exec cron /bin/sh /cron/goi.sh /api/cron/reminders
# Dùng wget của busybox (có sẵn trong alpine) nên image không cần cài thêm gì.
set -u
path="$1"
url="$(cat /run/mstudo/url)$path"
hdr="$(wget -S -q -O /tmp/cron-out -T 300 \
  --header "Authorization: Bearer $(cat /run/mstudo/secret)" "$url" 2>&1)"
code="$(printf '%s\n' "$hdr" | awk '/^ *HTTP\//{c=$2} END{print (c==""?"ERR":c)}')"
msg="[cron] $(date -u +%FT%TZ) $path → $code $(head -c 300 /tmp/cron-out 2>/dev/null)"; rm -f /tmp/cron-out
# Ghi ra log của container (docker compose logs cron) dù chạy từ crond hay exec.
echo "$msg" > /proc/1/fd/1 2>/dev/null || echo "$msg"
