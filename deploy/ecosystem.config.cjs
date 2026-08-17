// ─────────────────────────────────────────────────────────────────────────────
// Cấu hình pm2 — bộ quản lý tiến trình giữ cho Next.js luôn sống trên VPS.
//
// Chạy trên VPS trong thư mục /var/www/mstudo/current:
//     pm2 start deploy/ecosystem.config.cjs
//     pm2 save
//
// Deploy lần sau dùng `pm2 reload mstudo` (KHÔNG phải `restart`) — reload chờ
// tiến trình mới sẵn sàng rồi mới cắt tiến trình cũ, nên studio đang upload ảnh
// không bị đứt giữa chừng.
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  apps: [
    {
      name: "mstudo",

      // Bản build standalone tự sinh server.js — không cần `next start`, nhẹ RAM
      // hơn và không cần node_modules đầy đủ trên VPS.
      script: "server.js",
      cwd: "/var/www/mstudo/current",

      // ── VPS 2GB: chỉ MỘT tiến trình ────────────────────────────────────────
      // Cám dỗ lớn nhất là bật cluster mode nhiều instance cho "nhanh hơn".
      // Với 2GB RAM thì làm vậy là tự sát: mỗi instance Next.js ăn 400–700MB,
      // hai instance là chạm trần và kernel bắt đầu OOM-kill.
      // Ngoài ra rate-limit của app (src/lib/rate-limit.ts) đếm trong bộ nhớ
      // tiến trình — nhiều instance thì mỗi instance đếm riêng, giới hạn hỏng.
      // Một tiến trình duy nhất vừa đủ RAM, vừa làm rate-limit chính xác.
      instances: 1,
      exec_mode: "fork",

      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1", // chỉ nghe nội bộ; Caddy là cửa duy nhất ra Internet

        // Trần heap của V8. Đặt thấp hơn RAM thật để V8 chủ động dọn rác thay vì
        // phình tới lúc kernel giết tiến trình. Với VPS 2GB: 1024MB là hợp lý.
        // VPS 4GB thì nâng lên 2048.
        NODE_OPTIONS: "--max-old-space-size=1024",
      },

      // Biến bí mật (Supabase key, Google secret, CRON_SECRET…) KHÔNG để trong
      // file này — file này nằm trong git. Chúng nằm ở /var/www/mstudo/shared/.env
      // và được nạp bởi deploy/run.sh trước khi gọi pm2.

      // ── Tự hồi phục ────────────────────────────────────────────────────────
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s", // chạy dưới 30s mà chết = coi như khởi động lỗi
      restart_delay: 3000,

      // Rò rỉ bộ nhớ hoặc một request nặng bất thường có thể đẩy tiến trình lên
      // cao. Tự khởi động lại ở 1400MB — trước khi kernel OOM-kill (mất sạch
      // request đang xử lý), và reload thì không đứt kết nối.
      max_memory_restart: "1400M",

      // ── Log ────────────────────────────────────────────────────────────────
      out_file: "/home/mstudo/logs/out.log",
      error_file: "/home/mstudo/logs/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      // Chờ tiến trình mới sẵn sàng rồi mới cắt cái cũ (zero-downtime reload).
      wait_ready: false,
      listen_timeout: 20000,
      kill_timeout: 30000, // cho request đang chạy (upload lớn) 30s để xong
    },
  ],
};
