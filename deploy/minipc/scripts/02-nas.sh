#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# BƯỚC NAS — Chia sẻ thư mục qua mạng (Samba/SMB) cho Windows, macOS, điện thoại.
#
#   sudo NAS_ROOT=/srv/nas bash 02-nas.sh
#
# Trước đó: gắn ổ dữ liệu vào NAS_ROOT (xem HUONG-DAN.md mục 6.1). Script KHÔNG
# định dạng ổ nào — việc xoá dữ liệu luôn để bạn tự làm bằng tay.
#
# Bảo mật:
#   • CHỈ máy trong LAN và trong Tailscale truy cập được (không bao giờ ra Internet)
#   • bắt buộc SMB3, có mã hoá khi máy khách hỗ trợ, cấm khách (guest)
#   • có Thùng rác (.recycle) — xoá nhầm qua mạng vẫn lấy lại được 30 ngày
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Chạy bằng: sudo bash $0"; exit 1; fi

NAS_ROOT="${NAS_ROOT:-/srv/nas}"
NAS_USER="${NAS_USER:-${SUDO_USER:-}}"
DEFAULT_IF="$(ip route show default | awk '{print $5; exit}')"
LAN_CIDR="${LAN_CIDR:-$(ip -o -f inet addr show "$DEFAULT_IF" | awk '{print $4; exit}')}"
LAN_CIDR="$(python3 -c "import ipaddress,sys;print(ipaddress.ip_interface(sys.argv[1]).network)" "$LAN_CIDR")"

if ! mountpoint -q "$NAS_ROOT"; then
  echo "⚠ $NAS_ROOT chưa phải là một ổ được gắn riêng (mount)."
  echo "  Dữ liệu NAS sẽ nằm chung ổ hệ điều hành. Muốn tiếp tục? [g]õ 'co' để đồng ý:"
  read -r ok; [[ "$ok" == "co" ]] || exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get install -y samba wsdd2 2>/dev/null || apt-get install -y samba wsdd

# Nhóm "nas": ai trong nhóm mới đọc/ghi được.
getent group nas >/dev/null || groupadd nas
usermod -aG nas "$NAS_USER"

mkdir -p "$NAS_ROOT"/{studio,ca-nhan,sao-luu-may-tinh}
chgrp -R nas "$NAS_ROOT"
chmod 2770 "$NAS_ROOT"/studio "$NAS_ROOT"/ca-nhan "$NAS_ROOT"/sao-luu-may-tinh

[[ -f /etc/samba/smb.conf.goc ]] || cp /etc/samba/smb.conf /etc/samba/smb.conf.goc
cat >/etc/samba/smb.conf <<EOF
[global]
   workgroup = WORKGROUP
   server string = MiniPC NAS
   server role = standalone server
   # --- Chỉ LAN + Tailscale ---
   interfaces = lo $DEFAULT_IF tailscale0
   bind interfaces only = no
   hosts allow = 127.0.0.1 $LAN_CIDR 100.64.0.0/10
   hosts deny = 0.0.0.0/0
   # --- Bảo mật ---
   server min protocol = SMB3
   smb encrypt = desired
   map to guest = never
   restrict anonymous = 2
   usershare allow guests = no
   load printers = no
   printing = bsd
   printcap name = /dev/null
   disable spoolss = yes
   log file = /var/log/samba/%m.log
   max log size = 1000
   # --- Tương thích macOS / iPhone ---
   vfs objects = catia fruit streams_xattr
   fruit:metadata = stream
   fruit:model = MacSamba
   fruit:posix_rename = yes
   fruit:delete_empty_adfiles = yes

[studio]
   comment = Du lieu chung cua studio
   path = $NAS_ROOT/studio
   valid users = @nas
   read only = no
   create mask = 0660
   directory mask = 2770
   vfs objects = catia fruit streams_xattr recycle
   recycle:repository = .recycle/%U
   recycle:keeptree = yes
   recycle:versions = yes
   recycle:touch = yes

[ca-nhan]
   comment = Thu muc rieng
   path = $NAS_ROOT/ca-nhan
   valid users = $NAS_USER
   read only = no
   create mask = 0600
   directory mask = 0700
   vfs objects = catia fruit streams_xattr recycle
   recycle:repository = .recycle
   recycle:keeptree = yes
   recycle:versions = yes

[sao-luu-may-tinh]
   comment = Time Machine / sao luu may tinh
   path = $NAS_ROOT/sao-luu-may-tinh
   valid users = @nas
   read only = no
   fruit:time machine = yes
   fruit:time machine max size = 1T
EOF
testparm -s >/dev/null

# Dọn thùng rác cũ hơn 30 ngày, mỗi đêm.
cat >/etc/cron.daily/nas-don-thung-rac <<EOF
#!/bin/sh
find "$NAS_ROOT" -path '*/.recycle/*' -type f -mtime +30 -delete 2>/dev/null
find "$NAS_ROOT" -path '*/.recycle/*' -type d -empty -delete 2>/dev/null
EOF
chmod +x /etc/cron.daily/nas-don-thung-rac

ufw allow from "$LAN_CIDR" to any port 445 proto tcp comment 'Samba tu LAN'
ufw allow from "$LAN_CIDR" to any port 5357 proto tcp comment 'WSD (Windows thay may)'
ufw allow from "$LAN_CIDR" to any port 3702 proto udp comment 'WSD discovery'

systemctl enable --now smbd
systemctl restart smbd
systemctl enable --now wsdd2 2>/dev/null || systemctl enable --now wsdd 2>/dev/null || true

echo
echo "▶ Đặt MẬT KHẨU NAS cho tài khoản '$NAS_USER' (nên khác mật khẩu đăng nhập máy):"
smbpasswd -a "$NAS_USER"
smbpasswd -e "$NAS_USER" >/dev/null

IP_LAN="$(ip -o -f inet addr show "$DEFAULT_IF" | awk '{split($4,a,"/");print a[1]; exit}')"
echo
echo "════════════════════════════════════════════════════════════════"
echo " NAS SẴN SÀNG. Kết nối:"
echo "   Windows : File Explorer → \\\\$IP_LAN\\studio"
echo "   macOS   : Finder → Cmd+K → smb://$IP_LAN/studio"
echo "   Ngoài nhà: bật Tailscale trên máy/điện thoại → dùng IP 100.x của minipc"
echo " Thêm người dùng NAS: sudo adduser --no-create-home --shell /usr/sbin/nologin TEN"
echo "                      sudo usermod -aG nas TEN && sudo smbpasswd -a TEN"
echo "════════════════════════════════════════════════════════════════"
