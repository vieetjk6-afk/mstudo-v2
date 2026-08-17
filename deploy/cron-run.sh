#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Gọi một job cron của ứng dụng và ghi lại kết quả.
#
#     deploy/cron-run.sh reminders
#
# Vì sao cần script này thay vì gọi thẳng curl trong crontab:
#   1. Crontab không đọc được .env → phải tự nạp CRON_SECRET ở đây.
#   2. Cron chạy âm thầm. Job lỗi mà không ai biết là kiểu hỏng tệ nhất —
#      script này ghi log có dấu thời gian và mã HTTP để còn truy được.
#   3. Thử lại 2 lần: app vừa reload xong thì request đầu có thể trượt.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

JOB="${1:?Thiếu tên job. Ví dụ: cron-run.sh reminders}"
ENV_FILE="/var/www/mstudo/shared/.env"
LOG="/home/mstudo/logs/cron.log"

say() { echo "[$(date '+%F %T')] [$JOB] $*" >>"$LOG"; }

if [[ ! -f "$ENV_FILE" ]]; then
	say "LỖI: không thấy $ENV_FILE"
	exit 1
fi

# Chỉ lấy đúng hai biến cần, không nạp cả file (tránh biến lạ ghi đè shell).
CRON_SECRET="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' ')"
MAIN_HOST="$(grep -E '^NEXT_PUBLIC_MAIN_HOST=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' ')"

if [[ -z "$CRON_SECRET" ]]; then
	say "LỖI: CRON_SECRET rỗng — route cron sẽ trả 401 và job không chạy"
	exit 1
fi

# Gọi thẳng vào tiến trình Next.js ở localhost: nhanh hơn, không phụ thuộc DNS
# hay chứng chỉ, và vẫn hoạt động cả khi tên miền đang trục trặc.
# Header Host đặt đúng tên miền chính vì các route cron dựng link bằng mainUrl().
URL="http://127.0.0.1:3000/api/cron/${JOB}"

for attempt in 1 2; do
	CODE="$(curl -sS -o /tmp/cron-$JOB.out -w '%{http_code}' \
		--max-time 600 \
		-H "Authorization: Bearer ${CRON_SECRET}" \
		${MAIN_HOST:+-H "Host: ${MAIN_HOST}"} \
		"$URL" 2>>"$LOG")"

	if [[ "$CODE" == "200" ]]; then
		say "OK — $(head -c 300 /tmp/cron-$JOB.out)"
		exit 0
	fi

	say "lần $attempt thất bại, HTTP $CODE — $(head -c 300 /tmp/cron-$JOB.out)"
	[[ $attempt -eq 1 ]] && sleep 20
done

say "THẤT BẠI sau 2 lần thử. Kiểm tra: pm2 logs mstudo"
exit 1
