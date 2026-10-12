#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# CÀI ĐẶT MÁY CHỦ Ở NHÀ — chạy MỘT LẦN trên Ubuntu Server 24.04 vừa cài xong.
#
#   sudo bash cai-dat.sh <URL-repo-git> [nhánh]
#
#   vd: sudo bash cai-dat.sh https://github.com/ten-ban/mstudo-v2.git main
#       sudo bash cai-dat.sh git@github.com:ten-ban/mstudo-v2.git main
#
# Chạy lại bao nhiêu lần cũng được (idempotent): bước nào đã xong thì bỏ qua.
#
# Việc script làm:
#   1. Múi giờ Asia/Ho_Chi_Minh
#   2. Cập nhật hệ thống + bật tự cập nhật bản vá bảo mật (unattended-upgrades)
#   3. Tường lửa ufw: CHẶN mọi kết nối vào, chỉ chừa SSH. Cloudflare Tunnel là
#      kết nối ĐI RA nên không cần mở cổng nào trên máy lẫn trên router.
#   4. Docker Engine + Compose plugin từ kho CHÍNH THỨC của Docker
#   5. /opt/mstudo ← clone repo; chép .env.example → .env nếu chưa có
#   6. In các bước còn lại phải làm bằng tay
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail

THU_MUC=/opt/mstudo
REPO_URL="${1:-}"
NHANH="${2:-main}"

xanh() { printf '\033[1;32m%s\033[0m\n' "$*"; }
vang() { printf '\033[1;33m%s\033[0m\n' "$*"; }
do_() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; }
buoc() { printf '\n\033[1;36m━━ %s\033[0m\n' "$*"; }

# ── Kiểm tra đầu vào ─────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  do_ "Cần quyền root. Chạy lại:  sudo bash $0 $*"
  exit 1
fi
if [ -z "$REPO_URL" ] && [ ! -d "$THU_MUC/.git" ]; then
  do_ "Thiếu địa chỉ repo. Cách dùng:  sudo bash $0 <URL-repo-git> [nhánh]"
  exit 1
fi
# shellcheck disable=SC1091
. /etc/os-release
if [ "${ID:-}" != "ubuntu" ]; then
  vang "Cảnh báo: script viết cho Ubuntu, máy này là '${ID:-?}'. Vẫn tiếp tục…"
fi
# Người thật sự gõ lệnh (không phải root) — sẽ là chủ thư mục và vào nhóm docker.
NGUOI_DUNG="${SUDO_USER:-}"
if [ -z "$NGUOI_DUNG" ] || [ "$NGUOI_DUNG" = "root" ]; then
  NGUOI_DUNG=""
  vang "Đang chạy thẳng bằng root (không qua sudo) — thư mục sẽ thuộc root."
fi
export DEBIAN_FRONTEND=noninteractive

# ── 1. Múi giờ ───────────────────────────────────────────────────────────────
buoc "1/6 Múi giờ"
if [ "$(timedatectl show -p Timezone --value 2>/dev/null)" != "Asia/Ho_Chi_Minh" ]; then
  timedatectl set-timezone Asia/Ho_Chi_Minh
  xanh "Đã đặt múi giờ Asia/Ho_Chi_Minh."
else
  xanh "Múi giờ đã là Asia/Ho_Chi_Minh."
fi

# ── 2. Cập nhật + tự vá bảo mật ─────────────────────────────────────────────
buoc "2/6 Cập nhật hệ thống + bật tự cập nhật bản vá"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw unattended-upgrades
# Tương đương "dpkg-reconfigure unattended-upgrades → Yes", nhưng không hỏi gì.
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
xanh "unattended-upgrades đã bật (bản vá bảo mật tự cài mỗi ngày)."

# ── 3. Tường lửa ─────────────────────────────────────────────────────────────
buoc "3/6 Tường lửa ufw (chặn mọi kết nối vào, chừa SSH)"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null
ufw status verbose | sed 's/^/   /'
vang "Lưu ý: KHÔNG mở thêm cổng nào, kể cả 80/443 — Cloudflare Tunnel không cần."

# ── 4. Docker Engine + Compose plugin (kho chính thức của Docker) ───────────
buoc "4/6 Docker Engine + Compose plugin"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 \
   && dpkg -s docker-ce >/dev/null 2>&1; then
  xanh "Docker đã có: $(docker --version)"
else
  # Gỡ các gói xung đột theo hướng dẫn của Docker (gói docker.io của Ubuntu…).
  for goi in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
    if dpkg -s "$goi" >/dev/null 2>&1; then apt-get remove -y "$goi"; fi
  done
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  xanh "Đã cài: $(docker --version) · $(docker compose version)"
fi
# Docker tự chạy khi bật máy → các container (restart: unless-stopped) tự lên theo.
systemctl enable --now docker >/dev/null
if [ -n "$NGUOI_DUNG" ] && ! id -nG "$NGUOI_DUNG" | grep -qw docker; then
  usermod -aG docker "$NGUOI_DUNG"
  vang "Đã thêm '$NGUOI_DUNG' vào nhóm docker — ĐĂNG XUẤT rồi đăng nhập lại SSH để có hiệu lực."
fi

# ── 5. Mã nguồn + .env ───────────────────────────────────────────────────────
buoc "5/6 Mã nguồn ở $THU_MUC"
mkdir -p "$THU_MUC"
if [ -n "$NGUOI_DUNG" ]; then chown "$NGUOI_DUNG": "$THU_MUC"; fi
chay_git() {
  # Chạy git bằng tài khoản người dùng (để dùng được khoá SSH của họ).
  if [ -n "$NGUOI_DUNG" ]; then sudo -u "$NGUOI_DUNG" -H git "$@"; else git "$@"; fi
}
if [ -d "$THU_MUC/.git" ]; then
  xanh "Repo đã có — bỏ qua bước clone (cập nhật bằng cap-nhat.sh)."
else
  if [ -n "$(ls -A "$THU_MUC")" ]; then
    do_ "$THU_MUC không rỗng mà cũng không phải repo git. Dọn thư mục đó rồi chạy lại."
    exit 1
  fi
  if ! chay_git clone --branch "$NHANH" "$REPO_URL" "$THU_MUC"; then
    do_ "Clone thất bại. Repo riêng tư? Dùng địa chỉ SSH (git@github.com:…) và thêm"
    do_ "khoá SSH của máy này làm Deploy key (chỉ đọc) — xem HUONG-DAN.md bước 4."
    exit 1
  fi
  xanh "Đã clone nhánh '$NHANH'."
fi
THU_MUC_DEPLOY="$THU_MUC/deploy/home-server"
if [ ! -f "$THU_MUC_DEPLOY/.env" ]; then
  cp "$THU_MUC_DEPLOY/.env.example" "$THU_MUC_DEPLOY/.env"
  xanh "Đã tạo $THU_MUC_DEPLOY/.env từ .env.example."
else
  xanh ".env đã có — giữ nguyên."
fi
chmod 600 "$THU_MUC_DEPLOY/.env"
if [ -n "$NGUOI_DUNG" ]; then chown "$NGUOI_DUNG": "$THU_MUC_DEPLOY/.env"; fi
chmod +x "$THU_MUC_DEPLOY/cap-nhat.sh" "$THU_MUC_DEPLOY/cai-dat.sh" 2>/dev/null || true

# ── 6. Việc còn lại ──────────────────────────────────────────────────────────
buoc "6/6 XONG phần tự động. Còn lại làm bằng tay:"
cat <<EOF

  a) Đăng xuất SSH rồi đăng nhập lại (để dùng docker không cần sudo).

  b) Tạo Cloudflare Tunnel (HUONG-DAN.md bước 5), chép TOKEN.

  c) Điền biến môi trường — giá trị GIỐNG HỆT bên Vercel:
       nano $THU_MUC_DEPLOY/.env
     Tối thiểu: TUNNEL_TOKEN, MEDIA_HOST, NEXT_PUBLIC_MEDIA_ORIGIN,
     NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
     SUPABASE_SERVICE_ROLE_KEY, GOOGLE_API_KEY, CRON_SECRET,
     INBOX_INGEST_SECRET, ZALO_SESSION_SECRET, NEXT_PUBLIC_MAIN_HOST.

  d) Dựng + chạy (lần đầu ~10–15 phút trên N100):
       cd $THU_MUC_DEPLOY && ./cap-nhat.sh

  e) Kiểm tra từ điện thoại/máy khác:  https://<MEDIA_HOST>/api/version

  f) Trên Vercel: đặt NEXT_PUBLIC_MEDIA_ORIGIN rồi Redeploy.
     Trên GitHub: biến repo FACE_SCAN_ON_HOME=true.

EOF
