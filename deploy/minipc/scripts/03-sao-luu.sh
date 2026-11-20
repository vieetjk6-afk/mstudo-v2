#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SAO LƯU — dùng restic (mã hoá, chống trùng lặp, giữ nhiều phiên bản).
#
# Cài một lần (tạo kho sao lưu + hẹn giờ 01:30 mỗi đêm):
#   sudo BACKUP_REPO=/mnt/backup/restic bash 03-sao-luu.sh cai-dat
# Chạy tay / xem các bản đã có / khôi phục:
#   sudo bash 03-sao-luu.sh chay
#   sudo bash 03-sao-luu.sh danh-sach
#   sudo restic -r /mnt/backup/restic --password-file /root/.restic-pass \
#        restore latest --target /tmp/khoi-phuc --include /srv/nas/studio/ten-file
#
# Kho có thể là ổ USB gắn ngoài (/mnt/backup/...) hoặc đám mây (Backblaze B2,
# S3, hoặc Google Drive qua rclone: BACKUP_REPO=rclone:gdrive:minipc-backup).
# Quy tắc 3-2-1: NAS chỉ là MỘT bản. RAID/ổ thứ hai KHÔNG phải sao lưu.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Chạy bằng: sudo bash $0 ..."; exit 1; fi

CONF=/etc/mstudo-backup.conf
PASS=/root/.restic-pass
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MSTUDO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

case "${1:-}" in
cai-dat)
  : "${BACKUP_REPO:?Đặt BACKUP_REPO, vd /mnt/backup/restic}"
  NAS_ROOT="${NAS_ROOT:-/srv/nas}"
  if [[ ! -s $PASS ]]; then
    umask 077; openssl rand -base64 32 >"$PASS"
    echo "⚠ ĐÃ TẠO MẬT KHẨU KHO SAO LƯU tại $PASS"
    echo "  CHÉP NÓ RA GIẤY / trình quản lý mật khẩu NGAY. Mất là mất hết bản sao lưu:"
    cat "$PASS"
  fi
  cat >"$CONF" <<EOF
BACKUP_REPO="$BACKUP_REPO"
BACKUP_PATHS="$NAS_ROOT $MSTUDO_DIR/.env /etc/samba/smb.conf"
EOF
  # shellcheck disable=SC1090
  . "$CONF"
  restic -r "$BACKUP_REPO" --password-file "$PASS" cat config >/dev/null 2>&1 \
    || restic -r "$BACKUP_REPO" --password-file "$PASS" init
  cat >/etc/systemd/system/mstudo-backup.service <<EOF
[Unit]
Description=Sao luu NAS + cau hinh mstudo (restic)
After=network-online.target
[Service]
Type=oneshot
Nice=10
IOSchedulingClass=idle
ExecStart=/usr/bin/env bash $SCRIPT_DIR/03-sao-luu.sh chay
EOF
  cat >/etc/systemd/system/mstudo-backup.timer <<'EOF'
[Unit]
Description=Sao luu moi dem 01:30
[Timer]
OnCalendar=*-*-* 01:30:00
Persistent=true
RandomizedDelaySec=10m
[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now mstudo-backup.timer
  echo "✔ Đã hẹn giờ. Chạy thử ngay: sudo bash $0 chay"
  ;;
chay)
  # shellcheck disable=SC1090
  . "$CONF"
  R=(restic -r "$BACKUP_REPO" --password-file "$PASS")
  # shellcheck disable=SC2086
  "${R[@]}" backup $BACKUP_PATHS --exclude '*/.recycle/*' --tag tu-dong
  # Giữ: 7 bản ngày, 4 bản tuần, 12 bản tháng.
  "${R[@]}" forget --tag tu-dong --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune
  # Mỗi chủ nhật đọc thử 5% dữ liệu để chắc bản sao lưu không hỏng.
  [[ $(date +%u) == 7 ]] && "${R[@]}" check --read-data-subset=5%
  echo "✔ Sao lưu xong $(date '+%F %T')"
  ;;
danh-sach)
  # shellcheck disable=SC1090
  . "$CONF"; restic -r "$BACKUP_REPO" --password-file "$PASS" snapshots
  ;;
*)
  sed -n '2,20p' "$0"; exit 1 ;;
esac
