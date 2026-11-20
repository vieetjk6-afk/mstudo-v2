#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# BƯỚC 1 — Biến minipc (Ubuntu Server 24.04 LTS mới cài) thành máy chủ an toàn.
#
#   sudo bash 01-chuan-bi-may.sh
#
# Làm gì:
#   • cập nhật hệ thống + tự cài bản vá bảo mật mỗi ngày
#   • múi giờ Việt Nam, công cụ cơ bản, theo dõi sức khoẻ ổ cứng (SMART)
#   • tường lửa UFW: CHẶN mọi kết nối vào, chỉ cho SSH từ mạng LAN + Tailscale
#   • fail2ban chặn dò mật khẩu SSH
#   • SSH: cấm root đăng nhập; tắt đăng nhập bằng mật khẩu NẾU đã có SSH key
#   • cài Docker (bản chính thức) + Tailscale
#
# Chạy lại nhiều lần cũng không sao (idempotent).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Chạy bằng: sudo bash $0"; exit 1; fi
ADMIN_USER="${SUDO_USER:-}"
if [[ -z "$ADMIN_USER" || "$ADMIN_USER" == "root" ]]; then
  echo "Hãy chạy bằng tài khoản thường có sudo (không phải đăng nhập root)."; exit 1
fi

# Mạng LAN nhà bạn, vd 192.168.1.0/24. Tự dò theo card mạng mặc định.
DEFAULT_IF="$(ip route show default | awk '{print $5; exit}')"
LAN_CIDR="${LAN_CIDR:-$(ip -o -f inet addr show "$DEFAULT_IF" | awk '{print $4; exit}')}"
LAN_CIDR="$(python3 -c "import ipaddress,sys;print(ipaddress.ip_interface(sys.argv[1]).network)" "$LAN_CIDR")"
echo "▶ Card mạng: $DEFAULT_IF · Mạng LAN: $LAN_CIDR (đặt LAN_CIDR=... để đổi)"

echo "▶ 1/7 Cập nhật hệ thống"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git ufw fail2ban unattended-upgrades \
  smartmontools htop ncdu rsync restic jq

timedatectl set-timezone Asia/Ho_Chi_Minh

echo "▶ 2/7 Tự động cài bản vá bảo mật"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
# Tự khởi động lại lúc 4h sáng nếu bản vá kernel cần (app tự chạy lại nhờ Docker).
cat >/etc/apt/apt.conf.d/52mstudo-reboot <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF

echo "▶ 3/7 Cài Docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Giới hạn log Docker để không đầy ổ.
mkdir -p /etc/docker
[[ -f /etc/docker/daemon.json ]] || cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true
}
EOF
systemctl enable --now docker
systemctl restart docker
# LƯU Ý: nhóm docker = quyền root. Chỉ thêm tài khoản quản trị của bạn.
usermod -aG docker "$ADMIN_USER"

echo "▶ 4/7 Cài Tailscale (truy cập quản trị từ xa, không mở cổng)"
command -v tailscale >/dev/null || curl -fsSL https://tailscale.com/install.sh | sh

echo "▶ 5/7 Tường lửa UFW"
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$LAN_CIDR" to any port 22 proto tcp comment 'SSH tu LAN'
ufw allow in on tailscale0 comment 'Tailscale (may cua ban)'
ufw --force enable

echo "▶ 6/7 Siết SSH"
SSHD_DROPIN=/etc/ssh/sshd_config.d/99-mstudo.conf
AUTH_KEYS="$(getent passwd "$ADMIN_USER" | cut -d: -f6)/.ssh/authorized_keys"
{
  echo "PermitRootLogin no"
  echo "MaxAuthTries 4"
  echo "X11Forwarding no"
  echo "AllowUsers $ADMIN_USER"
  if [[ -s "$AUTH_KEYS" ]]; then
    echo "PasswordAuthentication no"
    echo "KbdInteractiveAuthentication no"
  fi
} >"$SSHD_DROPIN"
if [[ -s "$AUTH_KEYS" ]]; then
  echo "  ✔ Đã có SSH key → TẮT đăng nhập bằng mật khẩu."
else
  echo "  ⚠ Chưa có SSH key ở $AUTH_KEYS → vẫn để đăng nhập mật khẩu."
  echo "    Làm theo HUONG-DAN.md mục 3.2 rồi chạy lại script này."
fi
sshd -t && systemctl reload ssh

echo "▶ 7/7 fail2ban + SMART"
cat >/etc/fail2ban/jail.d/mstudo.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban smartmontools 2>/dev/null || systemctl enable --now fail2ban
systemctl restart fail2ban

echo
echo "════════════════════════════════════════════════════════════════"
echo " XONG. Việc tiếp theo:"
echo "  1) sudo tailscale up        (mở link hiện ra để đăng nhập Tailscale)"
echo "  2) Đăng xuất rồi SSH vào lại để quyền docker có hiệu lực"
echo "  3) Làm tiếp mục 5 trong HUONG-DAN.md (chạy mstudo)"
echo "════════════════════════════════════════════════════════════════"
