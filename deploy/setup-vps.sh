#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Dựng VPS từ số 0 cho mstudo. CHẠY MỘT LẦN DUY NHẤT, bằng quyền root.
#
#   ssh root@<IP-VPS>
#   curl -fsSL <link-raw-file-nay> -o setup-vps.sh
#   bash setup-vps.sh
#
# Script làm những việc sau, mỗi bước đều bỏ qua nếu đã làm rồi (chạy lại được):
#   1. Cập nhật hệ thống, đặt múi giờ VN
#   2. Tạo swap 4GB      ← BẮT BUỘC với VPS 2GB, xem ghi chú bên dưới
#   3. Tạo user `mstudo` không phải root để chạy app
#   4. Tường lửa: chỉ mở 22 / 80 / 443
#   5. fail2ban chặn dò mật khẩu SSH
#   6. Node.js 22 + pm2
#   7. Caddy
#   8. Tạo thư mục app và log
#
# Sau khi chạy xong, làm tiếp theo docs/chuyen-sang-vps.md mục 4.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="mstudo"
APP_DIR="/var/www/mstudo"
NODE_MAJOR="22"
SWAP_SIZE="4G"

log() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
ok() { printf '\033[0;32m  ✓ %s\033[0m\n' "$*"; }
skip() { printf '\033[0;33m  – %s (đã có, bỏ qua)\033[0m\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
	echo "Phải chạy bằng root: sudo bash $0" >&2
	exit 1
fi

# ── 1. Hệ thống ──────────────────────────────────────────────────────────────
log "1/8 Cập nhật hệ thống + múi giờ Việt Nam"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl ca-certificates gnupg rsync git ufw fail2ban htop
timedatectl set-timezone Asia/Ho_Chi_Minh
ok "Múi giờ: $(timedatectl show -p Timezone --value)"

# ── 2. Swap ──────────────────────────────────────────────────────────────────
# VPS 2GB không đủ RAM cho những lúc cao điểm (nhiều studio cùng xuất file, cùng
# upload ảnh). Không có swap thì kernel sẽ OOM-kill tiến trình Next.js và trang
# sập đột ngột. Swap 4GB là lưới an toàn — chậm còn hơn chết.
#
# swappiness=10: chỉ dùng swap khi RAM thật sự cạn, không đẩy sớm (giữ tốc độ).
log "2/8 Tạo swap ${SWAP_SIZE}"
if swapon --show | grep -q '/swapfile'; then
	skip "swapfile"
else
	fallocate -l "$SWAP_SIZE" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
	chmod 600 /swapfile
	mkswap /swapfile >/dev/null
	swapon /swapfile
	grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
	ok "Swap ${SWAP_SIZE} đã bật"
fi
sysctl -qw vm.swappiness=10
grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >>/etc/sysctl.conf

# ── 3. User chạy app ─────────────────────────────────────────────────────────
# Không bao giờ chạy app web bằng root: một lỗ hổng trong app = mất cả máy chủ.
log "3/8 Tạo user '$APP_USER'"
if id "$APP_USER" &>/dev/null; then
	skip "user $APP_USER"
else
	adduser --disabled-password --gecos "" "$APP_USER"
	ok "Đã tạo user $APP_USER"
fi
# Cho phép SSH vào thẳng user này bằng đúng khoá đang dùng cho root.
if [[ -f /root/.ssh/authorized_keys ]]; then
	mkdir -p "/home/$APP_USER/.ssh"
	cp /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/authorized_keys"
	chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh"
	chmod 700 "/home/$APP_USER/.ssh"
	chmod 600 "/home/$APP_USER/.ssh/authorized_keys"
	ok "Đã chép khoá SSH sang $APP_USER"
fi

# ── 4. Tường lửa ─────────────────────────────────────────────────────────────
log "4/8 Tường lửa (chỉ mở SSH + HTTP + HTTPS)"
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ok "$(ufw status | head -1)"

# ── 5. fail2ban ──────────────────────────────────────────────────────────────
log "5/8 fail2ban (chặn IP dò mật khẩu SSH)"
cat >/etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled  = true
maxretry = 5
bantime  = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban >/dev/null 2>&1
ok "fail2ban đang chạy"

# ── 6. Node.js + pm2 ─────────────────────────────────────────────────────────
log "6/8 Node.js ${NODE_MAJOR} + pm2"
if command -v node &>/dev/null && [[ "$(node -v)" == v${NODE_MAJOR}.* ]]; then
	skip "Node $(node -v)"
else
	curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
	apt-get install -y -qq nodejs
	ok "Node $(node -v)"
fi
if command -v pm2 &>/dev/null; then
	skip "pm2"
else
	npm install -g pm2 >/dev/null
	ok "pm2 $(pm2 -v)"
fi
# pm2 tự khởi động lại app sau khi VPS reboot.
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null
ok "pm2 sẽ tự chạy lại sau khi khởi động máy"

# ── 7. Caddy ─────────────────────────────────────────────────────────────────
log "7/8 Caddy"
if command -v caddy &>/dev/null; then
	skip "caddy $(caddy version | head -1)"
else
	apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
		gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' |
		tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
	apt-get update -qq
	apt-get install -y -qq caddy
	ok "caddy $(caddy version | head -1)"
fi
mkdir -p /var/log/caddy
chown -R caddy:caddy /var/log/caddy

# ── 8. Thư mục app ───────────────────────────────────────────────────────────
log "8/8 Thư mục ứng dụng"
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared" "/home/$APP_USER/logs"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "/home/$APP_USER/logs"
ok "$APP_DIR"

cat <<EOF

╭──────────────────────────────────────────────────────────────────╮
│  XONG PHẦN DỰNG MÁY.                                             │
╰──────────────────────────────────────────────────────────────────╯

RAM/Swap hiện tại:
$(free -h | sed 's/^/    /')

Việc tiếp theo (làm theo docs/chuyen-sang-vps.md mục 4):

  1. Tạo file biến môi trường:
       sudo -u $APP_USER nano $APP_DIR/shared/.env
     Chép nội dung từ deploy/env.vps.example rồi điền giá trị thật.

  2. Chép Caddyfile lên máy chủ:
       (từ máy bạn) scp deploy/Caddyfile root@<IP>:/etc/caddy/Caddyfile
       (trên VPS)   sudo caddy validate --config /etc/caddy/Caddyfile
                    sudo systemctl reload caddy

  3. Cài cron:
       sudo -u $APP_USER crontab deploy/crontab.txt

  4. Deploy lần đầu: chạy workflow "Deploy to VPS" trên GitHub Actions.

EOF
