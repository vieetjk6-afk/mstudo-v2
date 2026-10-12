#!/bin/sh
# QUÉT KHUÔN MẶT Ở NHÀ — bản sao của .github/workflows/quet-khuon-mat.yml, nhưng
# gọi thẳng container `app` trong mạng nội bộ Docker (không ra Internet).
#
# Khác GitHub ở chỗ: máy nhà không có trần 60 giây của Vercel, nên đặt
# FACE_SCAN_BUDGET_MS=240000 trong .env (mỗi lượt quét ~160 ảnh thay vì ~30).
# Một vòng có thể dài hơn 10 phút → `flock -n`: vòng trước chưa xong thì vòng
# này bỏ qua, không bao giờ hai tiến trình cùng quét (giống `concurrency` ở GitHub).
. /run/cron.env
set -u

[ "${HOME_CRON_FACE_SCAN:-true}" = "true" ] || exit 0

exec 9>/tmp/quet-khuon-mat.lock
if ! flock -n 9; then
  echo "[quét] vòng trước còn đang chạy — bỏ qua lượt này."
  exit 0
fi

base="${APP_URL:-http://app:3000}"
so_luot="${FACE_SCAN_ROUNDS:-8}"
han="${FACE_SCAN_MAX_TIME:-330}"
i=1
while [ "$i" -le "$so_luot" ]; do
  ma=$(curl -sS -o /tmp/quet-ra.json -w '%{http_code}' --max-time "$han" \
         -H "Authorization: Bearer ${CRON_SECRET}" "${base}/api/cron/face-scan" || echo "000")
  if [ "$ma" = "401" ]; then
    echo "[quét] App trả 401 — CRON_SECRET trong .env khác với app đang chạy."
    exit 1
  fi
  if [ "$ma" != "200" ]; then
    ly_do=$(jq -r '[.error, .hint] | map(select(.)) | join(" · ")' /tmp/quet-ra.json 2>/dev/null || true)
    echo "[quét] lượt $i: app trả ${ma}. ${ly_do:-thân không phải JSON (app chưa lên? xem: docker compose logs app)}"
    exit 1
  fi
  if ! jq -e . /tmp/quet-ra.json >/dev/null 2>&1; then
    echo "[quét] lượt $i: 200 nhưng thân không phải JSON."
    exit 1
  fi
  jq -r --arg i "$i" '"[quét] lượt \($i) · quét \([.reports[]?.scanned // 0]|add // 0) ảnh"
       + " · gom \([.reports[]?.clustered // 0]|add // 0) người"
       + " · lỗi tải \([.reports[]?.failed // 0]|add // 0)"
       + " · hàng đợi \(.daNhinThay.canQuet|length) quét / \(.daNhinThay.canGom|length) gom"
       + " · \(.ms // 0) ms"' /tmp/quet-ra.json
  trang_thai=$(jq -r 'if .tat then "tat" elif (.reports|length) == 0 then "het" else "con" end' /tmp/quet-ra.json)
  [ "$trang_thai" = "tat" ] && { echo "[quét] Bộ quét đang TẮT (FACE_SCAN_OFF=1)."; exit 0; }
  [ "$trang_thai" = "het" ] && exit 0
  i=$((i + 1))
  sleep 3
done
