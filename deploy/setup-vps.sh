#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Dựng VPS từ số 0 cho mstudo. CHẠY MỘT LẦN, bằng quyền root.
#
#   ssh root@<IP-VPS>
#   curl -fsSL https://raw.githubusercontent.com/vieetjk6-afk/mstudo-v2/main/deploy/setup-vps.sh -o setup-vps.sh
#   less setup-vps.sh      # đọc lướt trước khi chạy
#   bash setup-vps.sh
#
# Chạy lại được nhiều lần — bước nào đã làm rồi thì tự bỏ qua.
#
# Các bước:
#   1. Cập nhật hệ thống, đặt múi giờ Việt Nam
#   2. Swap (lưới an toàn khi RAM cạn)
#   3. User `mstudo` không phải root để chạy app
#   4. Tường lửa: chỉ mở 22 / 80 / 443
#   5. fail2ban chặn dò mật khẩu SSH
#   6. Siết SSH (tắt đăng nhập bằng mật khẩu, cấm root)
#   7. Node.js 22
#   8. Caddy
#   9. Thư mục app + systemd unit + quyền sudo tối thiểu
#  10. Cập nhật bảo mật tự động
#
# Sau khi xong, làm tiếp theo docs/chuyen-sang-vps.md mục 5.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="mstudo"
APP_DIR="/var/www/mstudo"
NODE_MAJOR="22"
REPO_RAW="https://raw.githubusercontent.com/vieetjk6-afk/mstudo-v2/main"

log() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
ok() { printf '\033[0;32m  ✓ %s\033[0m\n' "$*"; }
skip() { printf '\033[0;33m  – %s (đã có, bỏ qua)\033[0m\n' "$*"; }
warn() { printf '\033[0;33m  ! %s\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "Phải chạy bằng root: sudo bash $0" >&2; exit 1; }

# ── 1. Hệ thống ──────────────────────────────────────────────────────────────
log "1/10 Cập nhật hệ thống + múi giờ Việt Nam"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl ca-certificates gnupg rsync git ufw fail2ban htop unattended-upgrades \
	fontconfig fonts-dejavu-core
# fontconfig + font: BẮT BUỘC cho việc đóng dấu chìm lên ảnh (sharp dựng chữ qua
# SVG). Ubuntu bản tối giản KHÔNG có font nào — thiếu font thì chữ watermark
# render ra RỖNG, tức là khách nhận ảnh KHÔNG có dấu mà không ai phát hiện.
# DejaVu có đủ dấu tiếng Việt.
timedatectl set-timezone Asia/Ho_Chi_Minh
ok "Múi giờ: $(timedatectl show -p Timezone --value)"

# ── 2. Swap ──────────────────────────────────────────────────────────────────
# Swap là lưới an toàn, KHÔNG phải để thay RAM. Không có swap thì lúc cao điểm
# kernel giết thẳng tiến trình Next.js và trang sập đột ngột. Có swap thì máy
# chậm đi vài giây rồi trở lại — chậm còn hơn chết.
#
# Cỡ swap = 2× RAM, tối đa 4GB. VPS 2GB → 4GB swap.
RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
SWAP_MB=$((RAM_MB * 2)); [[ $SWAP_MB -gt 4096 ]] && SWAP_MB=4096
log "2/10 Swap ${SWAP_MB}MB (RAM phát hiện: ${RAM_MB}MB)"
if swapon --show | grep -q '/swapfile'; then
	skip "swapfile ($(swapon --show=SIZE --noheadings | head -1 | tr -d ' '))"
else
	fallocate -l "${SWAP_MB}M" /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count="$SWAP_MB" status=none
	chmod 600 /swapfile
	mkswap /swapfile >/dev/null
	swapon /swapfile
	grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
	ok "Swap ${SWAP_MB}MB đã bật"
fi
# swappiness=10: chỉ dùng swap khi RAM thật sự cạn, không đẩy sớm (giữ tốc độ).
sysctl -qw vm.swappiness=10
grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >>/etc/sysctl.conf

# ── 3. User chạy app ─────────────────────────────────────────────────────────
# Không bao giờ chạy app web bằng root: một lỗ hổng trong app = mất cả máy chủ.
log "3/10 User '$APP_USER'"
if id "$APP_USER" &>/dev/null; then
	skip "user $APP_USER"
else
	adduser --disabled-password --gecos "" "$APP_USER"
	ok "Đã tạo user $APP_USER"
fi
# Cho phép đọc log hệ thống mà không cần sudo.
usermod -aG systemd-journal "$APP_USER"

# Chép khoá SSH của root sang, để deploy và bạn đều vào được bằng user thường.
if [[ -f /root/.ssh/authorized_keys ]]; then
	mkdir -p "/home/$APP_USER/.ssh"
	cp /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/authorized_keys"
	chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh"
	chmod 700 "/home/$APP_USER/.ssh"
	chmod 600 "/home/$APP_USER/.ssh/authorized_keys"
	ok "Đã chép khoá SSH sang $APP_USER"
else
	warn "Root chưa có authorized_keys — thêm khoá cho $APP_USER thủ công trước khi làm bước 6"
fi

# ── 4. Tường lửa ─────────────────────────────────────────────────────────────
log "4/10 Tường lửa (chỉ mở SSH + HTTP + HTTPS)"
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ok "$(ufw status | head -1)"

# ── 5. fail2ban ──────────────────────────────────────────────────────────────
log "5/10 fail2ban (chặn IP dò mật khẩu SSH)"
cat >/etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled  = true
maxretry = 5
bantime  = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban >/dev/null 2>&1
ok "fail2ban đang chạy"

# ── 6. Siết SSH ──────────────────────────────────────────────────────────────
# Chỉ làm khi đã CHẮC CHẮN khoá SSH hoạt động — nếu không sẽ tự khoá mình ngoài
# cửa. Script kiểm tra có khoá rồi mới siết.
log "6/10 Siết SSH"
if [[ -s "/home/$APP_USER/.ssh/authorized_keys" ]]; then
	cat >/etc/ssh/sshd_config.d/99-mstudo.conf <<'EOF'
# Chỉ cho đăng nhập bằng khoá. Mật khẩu dù mạnh cũng bị dò cả ngày.
PasswordAuthentication no
KbdInteractiveAuthentication no
# Cấm đăng nhập thẳng bằng root — vào bằng user thường rồi sudo.
PermitRootLogin prohibit-password
EOF
	if sshd -t 2>/dev/null; then
		systemctl reload ssh 2>/dev/null || systemctl reload sshd
		ok "Đã tắt đăng nhập bằng mật khẩu"
		warn "ĐỪNG ĐÓNG cửa sổ SSH này. Mở cửa sổ MỚI và thử: ssh $APP_USER@<IP>"
		warn "Vào được thì mới đóng cửa sổ hiện tại."
	else
		rm -f /etc/ssh/sshd_config.d/99-mstudo.conf
		warn "Cấu hình SSH không hợp lệ — đã huỷ, giữ nguyên như cũ"
	fi
else
	warn "Chưa có khoá SSH cho $APP_USER — BỎ QUA bước siết SSH để bạn không bị khoá ngoài"
fi

# ── 7. Node.js ───────────────────────────────────────────────────────────────
log "7/10 Node.js ${NODE_MAJOR}"
if command -v node &>/dev/null && [[ "$(node -v)" == v${NODE_MAJOR}.* ]]; then
	skip "Node $(node -v)"
else
	curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
	apt-get install -y -qq nodejs
	ok "Node $(node -v)"
fi
# KHÔNG cài pm2: systemd làm đúng việc đó mà tốn 0 RAM (pm2 daemon ~67MB).

# ── 8. Caddy ─────────────────────────────────────────────────────────────────
log "8/10 Caddy"
if command -v caddy &>/dev/null; then
	skip "caddy $(caddy version | head -1)"
else
	apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
		gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		>/etc/apt/sources.list.d/caddy-stable.list
	apt-get update -qq
	apt-get install -y -qq caddy
	ok "caddy $(caddy version | head -1)"
fi
mkdir -p /var/log/caddy && chown -R caddy:caddy /var/log/caddy

# ── 9. Thư mục app, systemd, quyền sudo ──────────────────────────────────────
log "9/10 Thư mục app + systemd + quyền deploy"
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# File .env rỗng với quyền chặt, để bạn điền sau.
if [[ ! -f "$APP_DIR/shared/.env" ]]; then
	install -o "$APP_USER" -g "$APP_USER" -m 600 /dev/null "$APP_DIR/shared/.env"
	ok "Đã tạo $APP_DIR/shared/.env rỗng (điền ở bước tiếp theo)"
else
	skip ".env"
	chmod 600 "$APP_DIR/shared/.env"
fi

# Cấp cho user deploy ĐÚNG một quyền root: khởi động lại dịch vụ mstudo.
# Cố ý không cấp gì thêm — không sửa được unit file thì không leo lên root được.
cat >/etc/sudoers.d/mstudo-deploy <<EOF
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart mstudo
EOF
chmod 440 /etc/sudoers.d/mstudo-deploy
visudo -c -q -f /etc/sudoers.d/mstudo-deploy || { rm -f /etc/sudoers.d/mstudo-deploy; warn "sudoers không hợp lệ, đã gỡ"; }
ok "Đã cấp quyền: $APP_USER được chạy 'systemctl restart mstudo'"

# systemd unit — tải từ repo nếu chưa có bản nào trên máy.
if [[ ! -f /etc/systemd/system/mstudo.service ]]; then
	if curl -fsSL "$REPO_RAW/deploy/mstudo.service" -o /etc/systemd/system/mstudo.service; then
		systemctl daemon-reload
		ok "Đã cài mstudo.service"
	else
		warn "Không tải được mstudo.service. Chép tay từ repo sang /etc/systemd/system/"
	fi
else
	skip "mstudo.service"
fi
# Bật để dịch vụ tự chạy sau mỗi lần khởi động máy. Bật được ngay cả khi chưa có
# bản build nào — lần deploy đầu tiên sẽ khởi động nó lên.
# Cố ý KHÔNG `--now`: chưa có code thì start chỉ tổ ghi một đống lỗi vào log.
if [[ -f /etc/systemd/system/mstudo.service ]]; then
	systemctl enable mstudo >/dev/null 2>&1
	ok "mstudo sẽ tự chạy lại sau khi khởi động máy"
fi

# ── 10. Cập nhật bảo mật tự động ─────────────────────────────────────────────
log "10/10 Cập nhật bảo mật tự động"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1
ok "Bản vá bảo mật sẽ tự cài"

IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo "<IP-VPS>")
cat <<EOF

╭──────────────────────────────────────────────────────────────────╮
│  XONG PHẦN DỰNG MÁY                                              │
╰──────────────────────────────────────────────────────────────────╯

  IP máy chủ : $IP
  RAM / Swap :
$(free -h | sed 's/^/      /')
  Ổ đĩa      :
$(df -h / | tail -1 | awk '{print "      đã dùng "$3" / "$2" ("$5")"}')

⚠️  TRƯỚC KHI ĐÓNG CỬA SỔ NÀY: mở cửa sổ mới và thử  ssh $APP_USER@$IP
    Vào được thì mới đóng. Nếu không, bạn sẽ bị khoá ngoài máy chủ.

Việc tiếp theo — docs/chuyen-sang-vps.md mục 5:

  1. Điền biến môi trường:
       sudo -u $APP_USER nano $APP_DIR/shared/.env
     (chép từ deploy/env.vps.example, nhớ đặt SERVER_IP=$IP)

  2. Chép Caddyfile:
       scp deploy/Caddyfile root@$IP:/etc/caddy/Caddyfile
       caddy validate --config /etc/caddy/Caddyfile
       systemctl reload caddy

  3. Cài cron:
       sudo -u $APP_USER crontab $APP_DIR/current/deploy/crontab.txt

  4. Deploy lần đầu: GitHub → Actions → "Deploy to VPS" → Run workflow

EOF
